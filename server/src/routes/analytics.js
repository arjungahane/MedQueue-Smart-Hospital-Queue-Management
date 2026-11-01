import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { mm1Metrics } from '../services/queueEngine.js';

const router = Router();
router.use(authenticate, allowRoles('ADMIN', 'STAFF', 'DOCTOR'));

router.get('/overview', async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [patients, appointments, departments, waiting, serving, completed, rows] = await Promise.all([
    prisma.user.count({ where: { role: 'PATIENT', active: true } }),
    prisma.appointment.count({ where: { createdAt: { gte: today } } }),
    prisma.department.findMany({ where: { active: true }, select: { id: true, name: true, averageServiceMin: true } }),
    prisma.queueToken.count({ where: { serviceDate: today, status: 'WAITING' } }),
    prisma.queueToken.count({ where: { serviceDate: today, status: 'SERVING' } }),
    prisma.queueToken.count({ where: { serviceDate: today, status: 'COMPLETED' } }),
    prisma.queueToken.groupBy({ by: ['departmentId', 'status'], where: { serviceDate: today }, _count: { _all: true } }),
  ]);
  const byDepartment = departments.map((department) => {
    const counts = rows.filter((row) => row.departmentId === department.id);
    const currentWaiting = counts.find((row) => row.status === 'WAITING')?._count._all ?? 0;
    const completions = counts.find((row) => row.status === 'COMPLETED')?._count._all ?? 0;
    const hoursElapsed = Math.max((Date.now() - today.getTime()) / 3_600_000, 1 / 60);
    const lambda = (currentWaiting + completions) / hoursElapsed;
    const mu = 60 / department.averageServiceMin;
    return { ...department, waiting: currentWaiting, completed: completions, mm1: mm1Metrics(lambda, mu) };
  });
  res.json({ data: { patients, appointments, departmentCount: departments.length, waiting, serving, completed, byDepartment } });
});

router.get('/departments', async (_req, res) => {
  const data = await prisma.department.findMany({ where: { active: true }, select: {
    id: true, name: true, averageServiceMin: true, policy: true,
    tokens: { where: { serviceDate: { equals: new Date(new Date().setHours(0, 0, 0, 0)) } },
      select: { status: true, registeredAt: true, calledAt: true, completedAt: true } },
  } });
  res.json({ data: data.map(({ tokens, ...department }) => ({
    ...department,
    arrivals: tokens.length,
    completed: tokens.filter((token) => token.status === 'COMPLETED').length,
    averageWaitMin: average(tokens.filter((token) => token.calledAt), (token) => (token.calledAt - token.registeredAt) / 60000),
  })) });
});

function average(items, getValue) {
  return items.length ? items.reduce((sum, item) => sum + getValue(item), 0) / items.length : 0;
}

export default router;
