import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const departments = [
  ['General Medicine', 'Primary care, preventive health, and common conditions.', 12],
  ['Cardiology', 'Heart and cardiovascular consultations.', 20],
  ['Neurology', 'Brain, spine, and nervous-system care.', 18],
  ['Orthopedics', 'Bone, joint, and musculoskeletal care.', 15],
  ['Dermatology', 'Skin, hair, and nail consultations.', 12],
  ['Pediatrics', 'Healthcare for infants, children, and adolescents.', 15],
  ['Ophthalmology', 'Eye health and vision care.', 15],
  ['ENT', 'Ear, nose, and throat consultations.', 12],
  ['Dentistry', 'Preventive and restorative dental care.', 20],
  ['Gynecology', 'Women’s reproductive and wellness care.', 20],
];

async function main() {
  for (const [name, description, averageServiceMin] of departments) {
    await prisma.department.upsert({ where: { name }, update: {}, create: { name, description, averageServiceMin } });
  }
  const general = await prisma.department.findUniqueOrThrow({ where: { name: 'General Medicine' } });
  const passwordHash = await bcrypt.hash('MedQueueDemo!2026', 12);
  const demoUsers = [
    { name: 'Maya Admin', email: 'admin@medqueue.test', role: 'ADMIN' },
    { name: 'Dr. Alex Morgan', email: 'doctor@medqueue.test', role: 'DOCTOR' },
    { name: 'Jordan Lee', email: 'staff@medqueue.test', role: 'STAFF' },
    { name: 'Taylor Patient', email: 'patient@medqueue.test', role: 'PATIENT' },
    { name: 'Riley Chen', email: 'riley@medqueue.test', role: 'PATIENT' },
    { name: 'Sam Rivera', email: 'sam@medqueue.test', role: 'PATIENT' },
  ];
  const users = {};
  for (const demo of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: { name: demo.name, passwordHash, role: demo.role, active: true },
      create: { ...demo, passwordHash },
    });
    users[demo.email] = user;
    if (demo.role === 'PATIENT') await prisma.patient.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, phone: '+1 555 0100' } });
    if (demo.role === 'DOCTOR') await prisma.doctor.upsert({ where: { userId: user.id }, update: { departmentId: general.id }, create: { userId: user.id, departmentId: general.id } });
    if (demo.role === 'STAFF') await prisma.staff.upsert({ where: { userId: user.id }, update: { departmentId: general.id }, create: { userId: user.id, departmentId: general.id } });
  }
  const demoDoctor = await prisma.doctor.findUniqueOrThrow({
    where: { userId: users['doctor@medqueue.test'].id },
  });

  const serviceDate = new Date();
  serviceDate.setHours(0, 0, 0, 0);
  const hasTokens = await prisma.queueToken.count({ where: { departmentId: general.id, serviceDate } });
  if (!hasTokens) {
    const samples = [
      { patientId: users['patient@medqueue.test'].id, code: 'A001', sequence: 1, status: 'SERVING', priority: 0, minutesAgo: 18 },
      { patientId: users['riley@medqueue.test'].id, code: 'A002', sequence: 2, status: 'WAITING', priority: 1, minutesAgo: 10 },
      { patientId: users['sam@medqueue.test'].id, code: 'A003', sequence: 3, status: 'WAITING', priority: 0, minutesAgo: 4 },
    ];
    for (const sample of samples) {
      const registeredAt = new Date(Date.now() - sample.minutesAgo * 60_000);
      const token = await prisma.queueToken.create({ data: {
        departmentId: general.id, patientId: sample.patientId, sequence: sample.sequence, code: sample.code,
        serviceDate, status: sample.status, priority: sample.priority, isWalkIn: true, registeredAt,
        ...(sample.status === 'SERVING' ? { calledAt: new Date() } : {}),
      } });
      await prisma.queueHistory.create({ data: { tokenId: token.id, action: 'REGISTERED', actorId: sample.patientId } });
    }
    await prisma.department.update({ where: { id: general.id }, data: { nextTokenNumber: 4 } });
  }

  const existingAppointment = await prisma.appointment.findFirst({
    where: { patientId: users['patient@medqueue.test'].id, departmentId: general.id, scheduledAt: { gte: serviceDate } },
  });
  if (!existingAppointment) {
    const scheduledAt = new Date(serviceDate);
    scheduledAt.setDate(scheduledAt.getDate() + 1);
    scheduledAt.setHours(10, 30, 0, 0);
    await prisma.appointment.create({
      data: {
        patientId: users['patient@medqueue.test'].id,
        departmentId: general.id,
        doctorId: demoDoctor.id,
        scheduleKey: `doctor:${demoDoctor.id}`,
        durationMinutes: general.averageServiceMin,
        scheduledAt,
      },
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
