import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAppointmentSlots,
  hasAppointmentConflict,
  isWithinAppointmentHours,
} from '../src/services/appointmentScheduling.js';

const appointment = (scheduledAt, durationMinutes = 15, status = 'BOOKED', id = 'existing') => ({
  id,
  scheduledAt: new Date(scheduledAt),
  durationMinutes,
  status,
});

test('rejects overlapping appointments and starts within the five-minute buffer', () => {
  const booked = [{ ...appointment('2026-11-03T10:00:00.000Z', 15), doctorId: 'doctor-a' }];
  assert.equal(hasAppointmentConflict({ scheduledAt: '2026-11-03T10:10:00Z', durationMinutes: 15 }, booked), true);
  assert.equal(hasAppointmentConflict({ scheduledAt: '2026-11-03T10:19:00Z', durationMinutes: 15 }, booked), true);
  assert.equal(hasAppointmentConflict({ scheduledAt: '2026-11-03T10:20:00Z', durationMinutes: 15 }, booked), false);
});

test('allows simultaneous appointments with different doctors', () => {
  const booked = [{ ...appointment('2026-11-03T10:00:00.000Z', 15), doctorId: 'doctor-a' }];
  assert.equal(hasAppointmentConflict({
    scheduledAt: '2026-11-03T10:00:00Z',
    durationMinutes: 15,
    doctorId: 'doctor-b',
  }, booked), false);
});

test('does not conflict with an appointment on another date', () => {
  const booked = [appointment('2026-11-03T10:00:00.000Z', 30)];
  assert.equal(hasAppointmentConflict({ scheduledAt: '2026-11-04T10:00:00Z', durationMinutes: 30 }, booked), false);
});

test('uses each existing appointment duration when calculating its buffer', () => {
  const booked = [appointment('2026-11-03T10:00:00.000Z', 30)];
  assert.equal(hasAppointmentConflict({ scheduledAt: '2026-11-03T10:34:00Z', durationMinutes: 12 }, booked), true);
  assert.equal(hasAppointmentConflict({ scheduledAt: '2026-11-03T10:35:00Z', durationMinutes: 12 }, booked), false);
});

test('cancelled and completed appointments do not reserve a slot', () => {
  const released = [
    appointment('2026-11-03T10:00:00.000Z', 15, 'CANCELLED', 'cancelled'),
    appointment('2026-11-03T10:00:00.000Z', 15, 'COMPLETED', 'completed'),
  ];
  assert.equal(hasAppointmentConflict({ scheduledAt: '2026-11-03T10:00:00Z', durationMinutes: 15 }, released), false);
});

test('rescheduling excludes the appointment being moved', () => {
  const existing = [appointment('2026-11-03T10:00:00.000Z', 15, 'BOOKED', 'moving')];
  assert.equal(hasAppointmentConflict({ scheduledAt: '2026-11-03T10:00:00Z', durationMinutes: 15 }, existing, 'moving'), false);
});

test('availability includes only valid future starts and marks conflicts unavailable', () => {
  const slots = getAppointmentSlots({
    date: '2026-11-03',
    timezoneOffset: 0,
    durationMinutes: 15,
    appointments: [appointment('2026-11-03T10:00:00.000Z')],
    now: new Date('2026-11-03T08:00:00.000Z'),
  });
  const at = (time) => slots.find((slot) => slot.scheduledAt === `2026-11-03T${time}:00.000Z`);
  assert.equal(at('09:55').available, false);
  assert.equal(at('10:15').available, false);
  assert.equal(at('10:20').available, true);
  assert.equal(slots.some((slot) => new Date(slot.scheduledAt).getUTCHours() >= 17), false);
});

test('validates clinic hours, five-minute increments, dates, offsets, and durations', () => {
  assert.equal(isWithinAppointmentHours('2026-11-03T10:20:00.000Z', 15, 0), true);
  assert.equal(isWithinAppointmentHours('2026-11-03T10:17:00.000Z', 15, 0), false);
  assert.equal(isWithinAppointmentHours('2026-11-03T16:55:00.000Z', 15, 0), false);
  assert.throws(() => getAppointmentSlots({
    date: '2026-02-30', timezoneOffset: 0, durationMinutes: 15, appointments: [],
  }), RangeError);
  assert.throws(() => getAppointmentSlots({
    date: '2026-11-03', timezoneOffset: 0, durationMinutes: 181, appointments: [],
  }), RangeError);
});

test('creates availability in the patient time zone', () => {
  const slots = getAppointmentSlots({
    date: '2026-11-03',
    timezoneOffset: -330,
    durationMinutes: 15,
    appointments: [],
    now: new Date('2026-11-02T00:00:00.000Z'),
  });
  assert.equal(slots[0].scheduledAt, '2026-11-03T03:30:00.000Z');
});
