import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import departmentRoutes from './routes/departments.js';
import queueRoutes from './routes/queues.js';
import appointmentRoutes from './routes/appointments.js';
import analyticsRoutes from './routes/analytics.js';
import patientRoutes from './routes/patients.js';
import { errorHandler, notFound } from './middleware/errors.js';

export function createApp(io) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: false }));
  app.use(express.json({ limit: '32kb' }));
  app.use(pinoHttp({ redact: ['req.headers.authorization'] }));
  app.use((req, _res, next) => { req.io = io; next(); });
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/patients', patientRoutes);
  app.use('/api/queues', queueRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
