import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { callNext, changeTokenStatus, getMyActiveTokens, getQueue, registerToken, setPolicy } from '../services/queueService.js';

const router = Router();
const registerInput = z.object({
  departmentId: z.string().min(1),
  appointmentId: z.string().optional(),
  priority: z.number().int().min(0).max(1).default(0),
});

router.post('/register', authenticate, async (req, res) => {
  const input = registerInput.parse(req.body);
  const token = await registerToken({ ...input, patientId: req.user.sub, isWalkIn: !input.appointmentId });
  req.io.to(`department:${input.departmentId}`).emit('queue:updated', { departmentId: input.departmentId, reason: 'registered' });
  res.status(201).json({ data: token });
});

router.get('/:departmentId/status', async (req, res) => {
  res.json({ data: await getQueue(req.params.departmentId) });
});

router.get('/mine', authenticate, async (req, res) => {
  res.json({ data: await getMyActiveTokens(req.user.sub) });
});

router.get('/:departmentId', authenticate, allowRoles('DOCTOR', 'STAFF', 'ADMIN'), async (req, res) => {
  const queue = await getQueue(req.params.departmentId);
  res.json({ data: queue });
});

router.post('/:departmentId/call-next', authenticate, allowRoles('DOCTOR', 'STAFF', 'ADMIN'), async (req, res) => {
  const token = await callNext(req.params.departmentId, req.user.sub);
  req.io.to(`department:${req.params.departmentId}`).emit('queue:updated', { departmentId: req.params.departmentId, reason: 'called' });
  res.json({ data: token });
});

router.post('/:departmentId/:tokenId/complete', authenticate, allowRoles('DOCTOR', 'STAFF', 'ADMIN'), async (req, res) => {
  const token = await changeTokenStatus({ ...req.params, actorId: req.user.sub, status: 'COMPLETED' });
  req.io.to(`department:${req.params.departmentId}`).emit('queue:updated', { departmentId: req.params.departmentId, reason: 'completed' });
  res.json({ data: token });
});

router.post('/:departmentId/:tokenId/skip', authenticate, allowRoles('DOCTOR', 'STAFF', 'ADMIN'), async (req, res) => {
  const token = await changeTokenStatus({ ...req.params, actorId: req.user.sub, status: 'SKIPPED' });
  req.io.to(`department:${req.params.departmentId}`).emit('queue:updated', { departmentId: req.params.departmentId, reason: 'skipped' });
  res.json({ data: token });
});

router.put('/:departmentId/:tokenId/priority', authenticate, allowRoles('DOCTOR', 'STAFF', 'ADMIN'), async (req, res) => {
  const { priority } = z.object({ priority: z.number().int().min(0).max(1) }).parse(req.body);
  const token = await prisma.queueToken.update({
    where: { id: req.params.tokenId, departmentId: req.params.departmentId },
    data: { priority },
  });
  await prisma.queueHistory.create({ data: { tokenId: token.id, action: priority ? 'PRIORITY_SET' : 'PRIORITY_REMOVED', actorId: req.user.sub } });
  req.io.to(`department:${req.params.departmentId}`).emit('queue:updated', { departmentId: req.params.departmentId, reason: 'priority-changed' });
  res.json({ data: token });
});

router.put('/:departmentId/scheduling', authenticate, allowRoles('STAFF', 'ADMIN'), async (req, res) => {
  const { policy } = z.object({ policy: z.enum(['FIFO', 'LIFO', 'PRIORITY']) }).parse(req.body);
  const department = await setPolicy(req.params.departmentId, policy);
  req.io.to(`department:${req.params.departmentId}`).emit('queue:updated', { departmentId: req.params.departmentId, reason: 'policy-changed' });
  await prisma.activityLog.create({ data: { actorId: req.user.sub, action: `SCHEDULING_${policy}`, entity: 'Department', entityId: department.id } });
  res.json({ data: department });
});

export default router;
