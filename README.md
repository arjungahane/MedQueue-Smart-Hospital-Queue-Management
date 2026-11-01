# MedQueue

MedQueue is a full-stack outpatient queue management demonstration. It combines patient registration, appointment requests, department queues, staff controls, live queue updates, and operational analytics in one responsive application. It uses synthetic demonstration records and is not a certified clinical or hospital information system.

## Objectives and features

- Register patients and sign in with role-based access.
- Book appointments and register walk-ins into department queues.
- Generate department/day-specific tokens transactionally.
- Track waiting, serving, skipped, completed, and cancelled visits.
- Schedule with FIFO, LIFO, or priority-first ordering.
- Keep department clients synchronized over Socket.IO.
- Review queue metrics and the M/M/1 model with stability checks.
- Manage departments and queue policy as an administrator.

## Technology and architecture

- **Web:** React, Vite, Tailwind CSS, React Router, Axios, Lucide, Recharts, Framer Motion.
- **API:** Node.js, Express, JWT, bcrypt, Zod, Socket.IO, Helmet, rate limiting.
- **Data:** PostgreSQL and Prisma ORM.
- **Layout:** `client/` contains the responsive single-page app; `server/` contains the REST API, queue domain service, and Socket.IO server; `server/prisma/` contains the schema and seed script.

```text
MedQueue/
  client/src/          React application
  server/src/          API, auth, queue and analytics services
  server/prisma/       PostgreSQL schema and seed data
  .env.example         Local configuration template
```

## Requirements

- Node.js 20+
- PostgreSQL 14+

## Setup

1. Create a PostgreSQL database (for example `medqueue`).
2. Copy `.env.example` to `server/.env` and set `DATABASE_URL` and a long random `JWT_SECRET`.
3. Install dependencies and generate Prisma Client:

   ```sh
   npm install
   npm --prefix server install
   npm --prefix client install
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

4. Start both applications:

   ```sh
   npm run dev
   ```

   Web: http://localhost:5173
   API: http://localhost:4000/api
   Health check: http://localhost:4000/health

## Environment

See [.env.example](./.env.example). Never commit `.env` files. Set `CLIENT_ORIGIN` to the deployed frontend origin in production. Keep `JWT_SECRET` unique and private.

## Demo accounts

Seeding creates synthetic users with the same demo password, `MedQueueDemo!2026`:

| Role | Email |
|---|---|
| Admin | `admin@medqueue.test` |
| Doctor | `doctor@medqueue.test` |
| Staff | `staff@medqueue.test` |
| Patient | `patient@medqueue.test` |
| Patient | `riley@medqueue.test` |
| Patient | `sam@medqueue.test` |

Change or remove seeded credentials before any public deployment. These accounts and records are for local demonstration only.

## API overview

All JSON responses use `{ "data": ... }`; validation errors return `400`, authentication errors `401`, and authorization errors `403`.

| Method and path | Purpose |
|---|---|
| `POST /api/auth/register`, `/login`, `/logout` | Patient registration and session |
| `GET /api/auth/me` | Current authenticated account |
| `GET /api/departments` | Departments and current queue summaries |
| `POST /api/queues/register` | Register a walk-in or appointment token |
| `GET /api/queues/:departmentId/status` | Queue and serving status |
| `POST /api/queues/:departmentId/call-next` | Call the next token (staff/doctor/admin) |
| `POST /api/queues/:departmentId/:tokenId/complete` | Complete a consultation |
| `POST /api/queues/:departmentId/:tokenId/skip` | Skip a token |
| `PUT /api/queues/:departmentId/scheduling` | Change policy (admin/staff) |
| `POST /api/appointments`, `GET /api/appointments` | Create or list appointments |
| `GET /api/appointments/:id`, `PUT /api/appointments/:id`, `DELETE /api/appointments/:id` | Read, update, or cancel an appointment with ownership checks |
| `GET /api/patients`, `GET/PUT /api/patients/:id` | Staff directory and privacy-checked profile access |
| `GET /api/patients/:id/appointments` | Patient history with ownership checks |
| `GET /api/analytics/overview` | Queue counts and M/M/1 metrics |
| `POST /api/departments` | Create a department (admin) |

Socket.IO clients join `department:<id>` rooms with `join_department`; queue changes emit `queue:updated`.

## Analytics

The API uses arrivals per hour (`λ`) and service completions per hour (`μ`). Stable M/M/1 metrics are returned only when `λ < μ`: `ρ=λ/μ`, `P₀=1−ρ`, `L=λ/(μ−λ)`, `Lq=λ²/[μ(μ−λ)]`, `W=1/(μ−λ)`, and `Wq=λ/[μ(μ−λ)]`. Metrics derived from the demonstration dataset are estimates, not clinical or operational guarantees.

## Deployment

Provision managed PostgreSQL and set `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, and `PORT` on the API host. Run `npm run db:deploy` (or `npx prisma migrate deploy` from `server/`) as the release migration step, then start with `npm --prefix server start`. Build the frontend with `npm --prefix client run build` and deploy `client/dist` to Netlify; set `VITE_API_URL` to the API's `/api` URL and configure the API CORS origin. Configure the Socket.IO client to use the API origin (the client uses the configured API base URL). Do not use demo accounts in production.

## Testing

Run `npm test` for deterministic queue ordering and analytical-model tests. Run `npm run build` to validate the production frontend bundle. API/database integration requires a configured PostgreSQL service.

## Screenshots

Add current application screenshots here after running the demo locally.

## Future enhancements

- Appointment availability and doctor-specific time-slot management.
- Email/SMS delivery integration and auditable password reset flow.
- In-app/browser notifications and expanded user/staff administration.
- Multi-hospital tenancy and fine-grained configurable roles.
- Historical analytics dashboards and exportable reports.

## Contributors

MedQueue student project team.
