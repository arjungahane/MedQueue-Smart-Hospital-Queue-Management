export const APPOINTMENT_BUFFER_MINUTES = 5;
export const APPOINTMENT_MAX_DURATION_MINUTES = 180;
export const APPOINTMENT_SLOT_STEP_MINUTES = 5;
export const APPOINTMENT_START_HOUR = 9;
export const APPOINTMENT_END_HOUR = 17;

const activeStatuses = new Set(['BOOKED', 'CHECKED_IN']);

export function hasAppointmentConflict(candidate, appointments, excludeId) {
  const start = new Date(candidate.scheduledAt).getTime();
  const duration = Number(candidate.durationMinutes);
  if (!Number.isFinite(start) || !Number.isInteger(duration) || duration < 1 || duration > APPOINTMENT_MAX_DURATION_MINUTES) {
    throw new RangeError('Appointment start time and duration must be valid.');
  }
  const endWithBuffer = start + (duration + APPOINTMENT_BUFFER_MINUTES) * 60_000;

  return appointments.some((appointment) => {
    if (appointment.id === excludeId || !activeStatuses.has(appointment.status)) return false;
    if (candidate.doctorId && appointment.doctorId && appointment.doctorId !== candidate.doctorId) return false;
    const existingStart = new Date(appointment.scheduledAt).getTime();
    const existingDuration = Number(appointment.durationMinutes);
    if (!Number.isFinite(existingStart) || !Number.isInteger(existingDuration) ||
      existingDuration < 1 || existingDuration > APPOINTMENT_MAX_DURATION_MINUTES) {
      throw new RangeError('Existing appointment data has an invalid start time or duration.');
    }
    const existingEndWithBuffer = existingStart +
      (existingDuration + APPOINTMENT_BUFFER_MINUTES) * 60_000;
    return start < existingEndWithBuffer && endWithBuffer > existingStart;
  });
}

export function getAppointmentSlots({
  date,
  timezoneOffset,
  durationMinutes,
  appointments,
  doctorId,
  now = new Date(),
}) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const offset = Number(timezoneOffset);
  if (!dateMatch || !Number.isInteger(offset) || offset < -840 || offset > 840) {
    throw new RangeError('Choose a valid appointment date and time zone.');
  }
  const [, yearText, monthText, dayText] = dateMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const localMidnight = Date.UTC(year, month - 1, day);
  const parsedDate = new Date(localMidnight);
  if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) {
    throw new RangeError('Choose a valid appointment date.');
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > APPOINTMENT_MAX_DURATION_MINUTES) {
    throw new RangeError('Appointment duration must be between 1 and 180 minutes.');
  }

  const localTimeToUtc = (hour, minute) => new Date(
    localMidnight + (hour * 60 + minute + offset) * 60_000,
  );
  const firstSlot = localTimeToUtc(APPOINTMENT_START_HOUR, 0);
  const closingTime = localTimeToUtc(APPOINTMENT_END_HOUR, 0);
  const latestStart = closingTime.getTime() -
    (durationMinutes + APPOINTMENT_BUFFER_MINUTES) * 60_000;
  const currentTime = new Date(now).getTime();
  const slots = [];

  for (let time = firstSlot.getTime(); time <= latestStart; time += APPOINTMENT_SLOT_STEP_MINUTES * 60_000) {
    const scheduledAt = new Date(time);
    const conflict = hasAppointmentConflict({ scheduledAt, durationMinutes, doctorId }, appointments);
    const available = scheduledAt.getTime() > currentTime && !conflict;
    slots.push({
      scheduledAt: scheduledAt.toISOString(),
      available,
      reason: available ? null : conflict ? 'Booked or within the required 5-minute buffer' : 'This time has passed',
    });
  }

  return slots;
}

export function isWithinAppointmentHours(scheduledAt, durationMinutes, timezoneOffset) {
  const start = new Date(scheduledAt).getTime();
  const offset = Number(timezoneOffset);
  if (!Number.isFinite(start) || !Number.isInteger(offset) || offset < -840 || offset > 840 ||
    !Number.isInteger(durationMinutes) || durationMinutes < 1 ||
    durationMinutes > APPOINTMENT_MAX_DURATION_MINUTES) return false;

  const localStart = new Date(start - offset * 60_000);
  const localMinutes = localStart.getUTCHours() * 60 + localStart.getUTCMinutes();
  const opensAt = APPOINTMENT_START_HOUR * 60;
  const closesAt = APPOINTMENT_END_HOUR * 60;
  return localStart.getUTCSeconds() === 0 && localStart.getUTCMilliseconds() === 0 &&
    localMinutes >= opensAt && (localMinutes - opensAt) % APPOINTMENT_SLOT_STEP_MINUTES === 0 &&
    localMinutes + durationMinutes + APPOINTMENT_BUFFER_MINUTES <= closesAt;
}
