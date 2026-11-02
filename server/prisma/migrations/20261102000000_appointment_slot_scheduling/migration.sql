CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN "scheduleKey" TEXT;

UPDATE "Appointment" AS appointment
SET
  "durationMinutes" = department."averageServiceMin",
  "scheduleKey" = CASE
    WHEN appointment."doctorId" IS NULL THEN 'department:' || appointment."departmentId"
    ELSE 'doctor:' || appointment."doctorId"
  END
FROM "Department" AS department
WHERE appointment."departmentId" = department."id";

ALTER TABLE "Appointment"
ALTER COLUMN "scheduleKey" SET NOT NULL;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_durationMinutes_check"
CHECK ("durationMinutes" BETWEEN 1 AND 180);

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_doctorId_fkey"
FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Appointment_doctorId_scheduledAt_status_idx"
ON "Appointment"("doctorId", "scheduledAt", "status");

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_schedule_no_overlap"
EXCLUDE USING gist (
  "scheduleKey" WITH =,
  tsrange(
    "scheduledAt",
    "scheduledAt" + (("durationMinutes" + 5)::double precision * INTERVAL '1 minute'),
    '[)'
  ) WITH &&
)
WHERE ("status" IN ('BOOKED', 'CHECKED_IN'));
