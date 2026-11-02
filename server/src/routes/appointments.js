import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import {
  APPOINTMENT_BUFFER_MINUTES,
  APPOINTMENT_MAX_DURATION_MINUTES,
  getAppointmentSlots,
  hasAppointmentConflict,
  isWithinAppointmentHours,
} from '../services/appointmentScheduling.js';

const router = Router();
const activeStatuses = ['BOOKED', 'CHECKED_IN'];
const scheduleInput = z.object({
  departmentId: z.string().min(1),
  doctorId: z.string().min(1).optional(),
  scheduledAt: z.string().datetime(),
  timezoneOffset: z.number().int().min(-840).max(840).default(0),
  notes: z.string().max(500).optional(),
});
const availabilityInput = z.object({
  departmentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezoneOffset: z.coerce.number().int().min(-840).max(840).default(0),
  doctorId: z.string().min(1).optional(),
  excludeAppointmentId: z.string().min(1).optional(),
});
const updateInput = z.object({
  scheduledAt: z.string().datetime().optional(),
  doctorId: z.string().min(1).nullable().optional(),
  timezoneOffset: z.number().int().min(-840).max(840).default(0),
  notes: z.string().max(500).optional(),
});
const appointmentInclude = {
  department: { select: { id: true, name: true } },
  doctor: { select: { id: true, user: { select: { name: true } } } },
};

async function lockDepartmentSchedule(tx, departmentId) {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtext('medqueue:appointment-schedule'),
      hashtext(${departmentId})
    )
  `;
}

async function getDepartmentAndDoctor(tx, departmentId, doctorId) {
  const department = await tx.department.findUnique({
    where: { id: departmentId },
    include: { doctors: { select: { id: true } } },
  });
  if (!department || !department.active) {
    const error = new Error('Department not found or unavailable.');
    error.status = 404;
    throw error;
  }
  if (doctorId && !department.doctors.some((doctor) => doctor.id === doctorId)) {
    const error = new Error('Choose a doctor assigned to this department.');
    error.status = 400;
    throw error;
  }
  if (!doctorId && department.doctors.length > 0) {
    const error = new Error('Choose a doctor before selecting an appointment time.');
    error.status = 400;
    throw error;
  }
  return department;
}

function getScheduleKey(departmentId, doctorId) {
  return doctorId ? `doctor:${doctorId}` : `department:${departmentId}`;
}

function conflictError() {
  const error = new Error('This slot has already been booked or is within the required 5-minute buffer. Please select another time.');
  error.status = 409;
  return error;
}

async function findConflictingAppointments(tx, {
  departmentId,
  doctorId,
  scheduledAt,
  durationMinutes,
  excludeAppointmentId,
}) {
  const start = new Date(scheduledAt);
  const searchStart = new Date(start.getTime() -
    (APPOINTMENT_MAX_DURATION_MINUTES + APPOINTMENT_BUFFER_MINUTES) * 60_000);
  const searchEnd = new Date(start.getTime() +
    (durationMinutes + APPOINTMENT_BUFFER_MINUTES) * 60_000);
  const appointments = await tx.appointment.findMany({
    where: {
      departmentId,
      status: { in: activeStatuses },
      scheduledAt: { gte: searchStart, lt: searchEnd },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      ...(doctorId ? { OR: [{ doctorId }, { doctorId: null }] } : {}),
    },
    select: { id: true, scheduledAt: true, durationMinutes: true, status: true },
  });
  return hasAppointmentConflict({ scheduledAt: start, durationMinutes, doctorId }, appointments);
}

function emitAvailabilityUpdate(req, departmentId) {
  req.io.to(`appointment_department:${departmentId}`).emit('appointments:updated', { departmentId });
}

router.get('/availability', authenticate, async (req, res) => {
  const input = availabilityInput.parse(req.query);
  const date = new Date(`${input.date}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.date) {
    return res.status(400).json({ error: 'Choose a valid appointment date.' });
  }
  const clientLocalToday = new Date(Date.now() - input.timezoneOffset * 60_000).toISOString().slice(0, 10);
  if (input.date < clientLocalToday) {
    return res.status(400).json({ error: 'Choose a future appointment date.' });
  }

  const department = await getDepartmentAndDoctor(prisma, input.departmentId, input.doctorId);
  let durationMinutes = department.averageServiceMin;
  if (input.excludeAppointmentId) {
    const excluded = await prisma.appointment.findUnique({
      where: { id: input.excludeAppointmentId },
      select: { id: true, patientId: true, departmentId: true, durationMinutes: true, status: true },
    });
    if (!excluded) return res.status(404).json({ error: 'Appointment not found.' });
    if (req.user.role === 'PATIENT' && excluded.patientId !== req.user.sub) {
      return res.status(403).json({ error: 'You cannot reschedule another patient’s appointment.' });
    }
    if (excluded.departmentId !== input.departmentId || excluded.status !== 'BOOKED') {
      return res.status(400).json({ error: 'Choose a valid active appointment to reschedule.' });
    }
    durationMinutes = excluded.durationMinutes;
  }

  const firstSlot = new Date(date.getTime() +
    (9 * 60 + input.timezoneOffset) * 60_000);
  const closingTime = new Date(date.getTime() +
    (17 * 60 + input.timezoneOffset) * 60_000);
  const slots = getAppointmentSlots({
    date: input.date,
    timezoneOffset: input.timezoneOffset,
    durationMinutes,
    doctorId: input.doctorId,
    appointments: await prisma.appointment.findMany({
      where: {
        departmentId: input.departmentId,
        status: { in: activeStatuses },
        scheduledAt: {
          gte: new Date(firstSlot.getTime() -
            (APPOINTMENT_MAX_DURATION_MINUTES + APPOINTMENT_BUFFER_MINUTES) * 60_000),
          lt: closingTime,
        },
        ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
        ...(input.doctorId ? { OR: [{ doctorId: input.doctorId }, { doctorId: null }] } : {}),
      },
      select: { id: true, doctorId: true, scheduledAt: true, durationMinutes: true, status: true },
    }),
  });
  res.json({ data: { durationMinutes, slots } });
});

router.post('/', authenticate, async (req, res) => {
  const input = scheduleInput.parse(req.body);
  const scheduledAt = new Date(input.scheduledAt);
  if (scheduledAt <= new Date()) return res.status(400).json({ error: 'Choose a future appointment time.' });
  const appointment = await prisma.$transaction(async (tx) => {
    await lockDepartmentSchedule(tx, input.departmentId);
    const department = await getDepartmentAndDoctor(tx, input.departmentId, input.doctorId);
    const durationMinutes = department.averageServiceMin;
    if (!isWithinAppointmentHours(scheduledAt, durationMinutes, input.timezoneOffset)) {
      const error = new Error('Choose an available 5-minute slot between 9:00 AM and 5:00 PM.');
      error.status = 400;
      throw error;
    }
    if (await findConflictingAppointments(tx, {
      departmentId: input.departmentId,
      doctorId: input.doctorId,
      scheduledAt,
      durationMinutes,
    })) throw conflictError();

    const created = await tx.appointment.create({
      data: {
        departmentId: input.departmentId,
        doctorId: input.doctorId,
        scheduleKey: getScheduleKey(input.departmentId, input.doctorId),
        scheduledAt,
        durationMinutes,
        notes: input.notes,
        patientId: req.user.sub,
      },
      include: appointmentInclude,
    });
    await tx.notification.create({
      data: {
        userId: req.user.sub,
        title: 'Appointment confirmed',
        message: `Your ${created.department.name} appointment has been booked.`,
      },
    });
    return created;
  });
  emitAvailabilityUpdate(req, input.departmentId);
  res.status(201).json({ data: appointment });
});

router.get('/', authenticate, async (req, res) => {
  const where = req.user.role === 'PATIENT' ? { patientId: req.user.sub } : {};
  const appointments = await prisma.appointment.findMany({
    where,
    include: { ...appointmentInclude, token: true },
    orderBy: { scheduledAt: 'desc' },
    take: 100,
  });
  res.json({ data: appointments });
});

router.get('/:id', authenticate, async (req, res) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { ...appointmentInclude, token: true },
  });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
  if (req.user.role === 'PATIENT' && appointment.patientId !== req.user.sub) {
    return res.status(403).json({ error: 'You cannot view another patient’s appointment.' });
  }
  return res.json({ data: appointment });
});

router.put('/:id', authenticate, async (req, res) => {
  const input = updateInput.parse(req.body);
  const existing = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Appointment not found.' });
  if (req.user.role === 'PATIENT' && existing.patientId !== req.user.sub) {
    return res.status(403).json({ error: 'You cannot update another patient’s appointment.' });
  }
  if (existing.status !== 'BOOKED') return res.status(409).json({ error: 'Only booked appointments can be changed.' });

  const appointment = await prisma.$transaction(async (tx) => {
    await lockDepartmentSchedule(tx, existing.departmentId);
    const current = await tx.appointment.findUnique({ where: { id: req.params.id } });
    if (!current || current.status !== 'BOOKED') {
      const error = new Error('Only booked appointments can be changed.');
      error.status = 409;
      throw error;
    }
    const doctorId = input.doctorId === undefined ? current.doctorId : input.doctorId;
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : current.scheduledAt;
    if ((input.scheduledAt || input.doctorId !== undefined) && scheduledAt <= new Date()) {
      const error = new Error('Choose a future appointment time.');
      error.status = 400;
      throw error;
    }
    if (input.scheduledAt || input.doctorId !== undefined) {
      await getDepartmentAndDoctor(tx, current.departmentId, doctorId ?? undefined);
      if (!isWithinAppointmentHours(scheduledAt, current.durationMinutes, input.timezoneOffset)) {
        const error = new Error('Choose an available 5-minute slot between 9:00 AM and 5:00 PM.');
        error.status = 400;
        throw error;
      }
      if (await findConflictingAppointments(tx, {
        departmentId: current.departmentId,
        doctorId: doctorId ?? undefined,
        scheduledAt,
        durationMinutes: current.durationMinutes,
        excludeAppointmentId: current.id,
      })) throw conflictError();
    }
    return tx.appointment.update({
      where: { id: current.id },
      data: {
        ...(input.scheduledAt ? { scheduledAt } : {}),
        ...(input.doctorId !== undefined ? {
          doctorId,
          scheduleKey: getScheduleKey(current.departmentId, doctorId ?? undefined),
        } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      include: appointmentInclude,
    });
  });
  emitAvailabilityUpdate(req, existing.departmentId);
  return res.json({ data: appointment });
});

router.delete('/:id', authenticate, async (req, res) => {
  const existing = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Appointment not found.' });
  if (req.user.role === 'PATIENT' && existing.patientId !== req.user.sub) {
    return res.status(403).json({ error: 'You cannot cancel another patient’s appointment.' });
  }
  if (!['BOOKED', 'CHECKED_IN'].includes(existing.status)) {
    return res.status(409).json({ error: 'This appointment can no longer be cancelled.' });
  }

  const departmentId = existing.departmentId;
  await prisma.$transaction(async (tx) => {
    await lockDepartmentSchedule(tx, departmentId);
    const appointment = await tx.appointment.findUnique({ where: { id: req.params.id } });
    if (!appointment || !activeStatuses.includes(appointment.status)) {
      const error = new Error('This appointment can no longer be cancelled.');
      error.status = 409;
      throw error;
    }
    await tx.appointment.update({ where: { id: appointment.id }, data: { status: 'CANCELLED' } });
    const token = await tx.queueToken.findUnique({ where: { appointmentId: appointment.id } });
    if (token) await tx.queueToken.update({ where: { id: token.id }, data: { status: 'CANCELLED' } });
  });
  emitAvailabilityUpdate(req, departmentId);
  req.io.to(`department:${departmentId}`).emit('queue:updated', { departmentId, reason: 'cancelled' });
  res.json({ data: { cancelled: true } });
});

export default router;
