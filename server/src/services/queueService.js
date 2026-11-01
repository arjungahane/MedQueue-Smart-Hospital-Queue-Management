import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { orderWaitingTokens } from './queueEngine.js';

const startOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

async function serializable(work, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error.code !== 'P2034' || attempt === attempts - 1) throw error;
    }
  }
  throw new Error('Queue transaction could not be completed.');
}

export async function registerToken({ departmentId, patientId, appointmentId, priority = 0, isWalkIn = true }) {
  const serviceDate = startOfDay();
  const tomorrow = new Date(serviceDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const token = await serializable(async (tx) => {
    if (appointmentId) {
      const appointment = await tx.appointment.findFirst({
        where: { id: appointmentId, patientId, departmentId, scheduledAt: { gte: serviceDate, lt: tomorrow } },
      });
      if (!appointment) {
        const error = new Error('A valid appointment for this patient and department is required for check-in.');
        error.status = 403;
        throw error;
      }
      const existing = await tx.queueToken.findUnique({
        where: { appointmentId },
        include: { patient: { select: { id: true, name: true } }, department: { select: { id: true, name: true, policy: true, averageServiceMin: true } } },
      });
      if (existing) return existing;
      if (appointment.status !== 'BOOKED') {
        const error = new Error('This appointment is not available for check-in.');
        error.status = 409;
        throw error;
      }
    } else {
      const duplicate = await tx.queueToken.findFirst({
        where: { departmentId, patientId, serviceDate, status: { in: ['WAITING', 'SERVING'] } },
      });
      if (duplicate) {
        const error = new Error('You already have an active token for this department today.');
        error.status = 409;
        throw error;
      }
    }
    const department = await tx.department.update({
      where: { id: departmentId },
      data: { nextTokenNumber: { increment: 1 } },
    });
    const sequence = department.nextTokenNumber - 1;
    const code = `A${String(sequence).padStart(3, '0')}`;
    const created = await tx.queueToken.create({
      data: { departmentId, patientId, appointmentId, sequence, code, serviceDate, priority, isWalkIn },
      include: { patient: { select: { id: true, name: true } }, department: { select: { id: true, name: true, policy: true, averageServiceMin: true } } },
    });
    await tx.queueHistory.create({ data: { tokenId: created.id, action: 'REGISTERED', actorId: patientId } });
    if (appointmentId) {
      await tx.appointment.update({ where: { id: appointmentId }, data: { status: 'CHECKED_IN' } });
    }
    return created;
  });
  return token;
}

export async function getQueue(departmentId) {
  const serviceDate = startOfDay();
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    const error = new Error('Department not found.');
    error.status = 404;
    throw error;
  }
  const tokens = await prisma.queueToken.findMany({
    where: { departmentId, serviceDate, status: { in: ['WAITING', 'SERVING'] } },
    include: { patient: { select: { id: true, name: true } } },
    orderBy: { registeredAt: 'asc' },
  });
  const waiting = orderWaitingTokens(tokens.filter((token) => token.status === 'WAITING'), department.policy);
  const serving = tokens.find((token) => token.status === 'SERVING') ?? null;
  const averageServiceMin = department.averageServiceMin;
  return {
    department: { id: department.id, name: department.name, policy: department.policy },
    serving,
    currentPosition: serving ? 0 : null,
    waiting: waiting.map((token, index) => ({ ...token, position: index + 1,
      estimatedWaitMin: (index + (serving ? 1 : 0)) * averageServiceMin })),
    waitingCount: waiting.length,
    averageServiceMin,
    updatedAt: new Date().toISOString(),
  };
}

export async function getMyActiveTokens(patientId) {
  const serviceDate = startOfDay();
  const tokens = await prisma.queueToken.findMany({
    where: { patientId, serviceDate, status: { in: ['WAITING', 'SERVING'] } },
    include: { department: { select: { id: true, name: true, policy: true, averageServiceMin: true } } },
    orderBy: { registeredAt: 'desc' },
  });
  return Promise.all(tokens.map(async (token) => {
    const queue = await getQueue(token.departmentId);
    const position = token.status === 'SERVING' ? 0 : queue.waiting.findIndex((waiting) => waiting.id === token.id) + 1;
    return { ...token, position, estimatedWaitMin: token.status === 'SERVING' ? 0 :
      (position - 1 + (queue.serving ? 1 : 0)) * queue.averageServiceMin };
  }));
}

export async function callNext(departmentId, actorId) {
  return serializable(async (tx) => {
    const department = await tx.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      const error = new Error('Department not found.');
      error.status = 404;
      throw error;
    }
    const serving = await tx.queueToken.findFirst({ where: { departmentId, serviceDate: startOfDay(), status: 'SERVING' } });
    if (serving) {
      const error = new Error('Complete or skip the currently serving token first.');
      error.status = 409;
      throw error;
    }
    const candidates = await tx.queueToken.findMany({ where: { departmentId, serviceDate: startOfDay(), status: 'WAITING' } });
    const next = orderWaitingTokens(candidates, department.policy)[0];
    if (!next) {
      const error = new Error('There are no patients waiting in this department.');
      error.status = 409;
      throw error;
    }
    const updated = await tx.queueToken.update({ where: { id: next.id }, data: { status: 'SERVING', calledAt: new Date() },
      include: { patient: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } } });
    await tx.queueHistory.create({ data: { tokenId: next.id, action: 'CALLED', actorId } });
    return updated;
  });
}

export async function changeTokenStatus({ departmentId, tokenId, actorId, status }) {
  return serializable(async (tx) => {
    const token = await tx.queueToken.findFirst({ where: { id: tokenId, departmentId, status: { in: ['WAITING', 'SERVING'] } } });
    if (!token) {
      const error = new Error('Active token not found.');
      error.status = 404;
      throw error;
    }
    const updated = await tx.queueToken.update({ where: { id: tokenId }, data: {
      status, completedAt: status === 'COMPLETED' ? new Date() : null,
    }, include: { patient: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } } });
    await tx.queueHistory.create({ data: { tokenId, action: status, actorId } });
    if (updated.appointmentId && status === 'COMPLETED') {
      await tx.appointment.update({ where: { id: updated.appointmentId }, data: { status: 'COMPLETED' } });
    }
    return updated;
  });
}

export async function setPolicy(departmentId, policy) {
  return prisma.department.update({ where: { id: departmentId }, data: { policy } });
}
