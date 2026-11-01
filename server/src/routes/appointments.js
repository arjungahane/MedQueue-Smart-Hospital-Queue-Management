import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const appointmentInput = z.object({
  departmentId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

router.post('/', authenticate, async (req, res) => {
  const input = appointmentInput.parse(req.body);
  if (new Date(input.scheduledAt) <= new Date()) return res.status(400).json({ error: 'Choose a future appointment time.' });
  const appointment = await prisma.appointment.create({
    data: { ...input, scheduledAt: new Date(input.scheduledAt), patientId: req.user.sub },
    include: { department: { select: { id: true, name: true } } },
  });
  await prisma.notification.create({ data: { userId: req.user.sub, title: 'Appointment confirmed', message: `Your ${appointment.department.name} appointment has been booked.` } });
  res.status(201).json({ data: appointment });
});

router.get('/', authenticate, async (req, res) => {
  const where = req.user.role === 'PATIENT' ? { patientId: req.user.sub } : {};
  const appointments = await prisma.appointment.findMany({
    where, include: { department: { select: { id: true, name: true } }, token: true },
    orderBy: { scheduledAt: 'desc' }, take: 100,
  });
  res.json({ data: appointments });
});

router.get('/:id', authenticate, async (req, res) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { department: { select: { id: true, name: true } }, token: true },
  });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
  if (req.user.role === 'PATIENT' && appointment.patientId !== req.user.sub) {
    return res.status(403).json({ error: 'You cannot view another patient’s appointment.' });
  }
  return res.json({ data: appointment });
});

router.put('/:id', authenticate, async (req, res) => {
  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
  if (req.user.role === 'PATIENT' && appointment.patientId !== req.user.sub) {
    return res.status(403).json({ error: 'You cannot update another patient’s appointment.' });
  }
  if (appointment.status !== 'BOOKED') return res.status(409).json({ error: 'Only booked appointments can be changed.' });
  const input = z.object({
    scheduledAt: z.string().datetime().optional(),
    notes: z.string().max(500).optional(),
  }).parse(req.body);
  if (input.scheduledAt && new Date(input.scheduledAt) <= new Date()) {
    return res.status(400).json({ error: 'Choose a future appointment time.' });
  }
  return res.json({ data: await prisma.appointment.update({
    where: { id: req.params.id },
    data: { ...input, ...(input.scheduledAt ? { scheduledAt: new Date(input.scheduledAt) } : {}) },
    include: { department: { select: { id: true, name: true } } },
  }) });
});

router.delete('/:id', authenticate, async (req, res) => {
  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
  if (req.user.role === 'PATIENT' && appointment.patientId !== req.user.sub) return res.status(403).json({ error: 'You cannot cancel another patient’s appointment.' });
  if (!['BOOKED', 'CHECKED_IN'].includes(appointment.status)) return res.status(409).json({ error: 'This appointment can no longer be cancelled.' });
  const token = await prisma.queueToken.findUnique({ where: { appointmentId: appointment.id } });
  await prisma.$transaction([
    prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'CANCELLED' } }),
    ...(token ? [prisma.queueToken.update({ where: { id: token.id }, data: { status: 'CANCELLED' } })] : []),
  ]);
  if (token) req.io.to(`department:${appointment.departmentId}`).emit('queue:updated', { departmentId: appointment.departmentId, reason: 'cancelled' });
  res.json({ data: { cancelled: true } });
});

export default router;
