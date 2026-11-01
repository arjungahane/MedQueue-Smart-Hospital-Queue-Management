import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const credentials = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

router.post('/register', async (req, res) => {
  const input = credentials.extend({ name: z.string().trim().min(2).max(80), phone: z.string().max(30).optional() }).parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash, role: 'PATIENT',
      patient: { create: { phone: input.phone } } },
    select: { id: true, name: true, email: true, role: true },
  });
  const token = jwt.sign({ sub: user.id, role: user.role }, config.JWT_SECRET, { expiresIn: '8h' });
  res.status(201).json({ data: { user, token } });
});

router.post('/login', async (req, res) => {
  const input = credentials.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.active || !(await bcrypt.compare(input.password, user.passwordHash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, config.JWT_SECRET, { expiresIn: '8h' });
  return res.json({ data: { user: { id: user.id, name: user.name, email: user.email, role: user.role }, token } });
});

router.post('/logout', authenticate, (_req, res) => res.json({ data: { loggedOut: true } }));
router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { id: true, name: true, email: true, role: true, active: true } });
  if (!user?.active) return res.status(401).json({ error: 'This account is unavailable.' });
  return res.json({ data: user });
});

export default router;
