import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: config.CLIENT_ORIGIN, methods: ['GET', 'POST'] },
});
io.on('connection', (socket) => {
  socket.on('join_department', (departmentId) => {
    if (typeof departmentId === 'string' && departmentId.length <= 64) socket.join(`department:${departmentId}`);
  });
});
const app = createApp(io);
httpServer.on('request', app);
httpServer.listen(config.PORT, () => {
  console.log(`MedQueue API listening on http://localhost:${config.PORT}`);
});

async function shutdown() {
  httpServer.close();
  await prisma.$disconnect();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
