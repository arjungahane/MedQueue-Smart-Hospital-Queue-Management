import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), async (req, res) => {
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const patients = await prisma.user.findMany({
    where: { role: 'PATIENT', active: true },
    select: { id: true, name: true, email: true, patient: { select: { phone: true, birthDate: true } }, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
  res.json({ data: patients, nextCursor: patients.length === 50 ? patients.at(-1).id : null });
});

router.get('/:id', authenticate, async (req, res) => {
  if (req.user.role === 'PATIENT' && req.user.sub !== req.params.id) {
    return res.status(403).json({ error: 'You cannot view another patient’s profile.' });
  }
  if (!['PATIENT', 'ADMIN', 'STAFF', 'DOCTOR'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to view patient profiles.' });
  }
  const patient = await prisma.user.findFirst({
    where: { id: req.params.id, role: 'PATIENT', active: true },
    select: { id: true, name: true, email: true, patient: { select: { phone: true, birthDate: true } }, createdAt: true },
  });
  if (!patient) return res.status(404).json({ error: 'Patient not found.' });
  return res.json({ data: patient });
});

router.put('/:id', authenticate, async (req, res) => {
  const privileged = ['ADMIN', 'STAFF'].includes(req.user.role);
  if (!privileged && (req.user.role !== 'PATIENT' || req.user.sub !== req.params.id)) {
    return res.status(403).json({ error: 'You cannot update this patient profile.' });
  }
  const input = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().max(30).nullable().optional(),
  }).parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { patient: { upsert: { create: { phone: input.phone }, update: { phone: input.phone } } } } : {}),
    },
    select: { id: true, name: true, email: true, role: true, patient: { select: { phone: true, birthDate: true } } },
  });
  res.json({ data: user });
});

router.get('/:id/appointments', authenticate, async (req, res) => {
  if (req.user.role === 'PATIENT' && req.user.sub !== req.params.id) {
    return res.status(403).json({ error: 'You cannot view another patient’s appointments.' });
  }
  if (!['PATIENT', 'ADMIN', 'STAFF', 'DOCTOR'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to view appointments.' });
  }
  const appointments = await prisma.appointment.findMany({
    where: { patientId: req.params.id },
    include: { department: { select: { id: true, name: true } }, token: true },
    orderBy: { scheduledAt: 'desc' },
    take: 100,
  });
  res.json({ data: appointments });
});

export default router;
