import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, allowRoles } from '../middleware/auth.js';

const router = Router();
const departmentInput = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(500),
  averageServiceMin: z.number().int().min(1).max(180).default(12),
  policy: z.enum(['FIFO', 'LIFO', 'PRIORITY']).default('FIFO'),
});

router.get('/', async (_req, res) => {
  const departments = await prisma.department.findMany({
    where: { active: true }, orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true, averageServiceMin: true, policy: true,
      doctors: { select: { user: { select: { id: true, name: true } } } } },
  });
  res.json({ data: departments });
});

router.post('/', authenticate, allowRoles('ADMIN'), async (req, res) => {
  const input = departmentInput.parse(req.body);
  const department = await prisma.department.create({ data: input });
  await prisma.activityLog.create({ data: { actorId: req.user.sub, action: 'DEPARTMENT_CREATED', entity: 'Department', entityId: department.id } });
  res.status(201).json({ data: department });
});

router.put('/:id', authenticate, allowRoles('ADMIN'), async (req, res) => {
  const input = departmentInput.partial().parse(req.body);
  res.json({ data: await prisma.department.update({ where: { id: req.params.id }, data: input }) });
});

router.delete('/:id', authenticate, allowRoles('ADMIN'), async (req, res) => {
  await prisma.department.update({ where: { id: req.params.id }, data: { active: false } });
  res.json({ data: { deactivated: true } });
});

export default router;
