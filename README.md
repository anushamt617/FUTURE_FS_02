# FUTURE_FS_02 — Client Lead Management System (Mini CRM)

A full-stack CRM for the Future Interns Full Stack Web Development Task 2.

## Features
- Public website enquiry form that creates a lead in MongoDB
- Admin sign-in using a password hash (bcrypt)
- Session-based authentication with sessions stored in MongoDB
- Lead listing, search and status filtering
- Create, update status, set follow-up date, add notes and delete leads
- Dashboard counts for total, new, contacted and converted leads
- Server-side input validation, login rate limiting, Helmet security headers
- Responsive public form and admin dashboard

## Technology
Node.js, Express, MongoDB, Mongoose, HTML, CSS and vanilla JavaScript.

## Requirements
- Node.js 18 or newer
- Docker Desktop with Docker Compose, or a MongoDB server / MongoDB Atlas connection

## Run locally (Docker option)
1. Extract the project and open this folder in VS Code.
2. Start MongoDB:
   ```bash
   docker compose up -d
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy `.env.example` to `.env`.
5. Change `SESSION_SECRET` to a long random value (at least 32 characters), and set a unique admin password of at least 12 characters.
6. Start the app:
   ```bash
   npm start
   ```
7. Open `http://localhost:3000` for the public enquiry form.
8. Open `http://localhost:3000/admin` and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

If using MongoDB Atlas, replace `MONGODB_URI` with your Atlas connection string. Keep `.env` private and never commit it to GitHub.

## Admin account behaviour
On first startup, the app creates the admin user from the environment variables. If that email already exists, the app does not overwrite its password on subsequent starts. To change an existing admin password, implement a dedicated password-change workflow or update the database securely; changing `.env` alone will not reset it.

## API overview
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/contact` | Public website enquiry submission |
| POST | `/api/auth/login` | Admin sign-in |
| POST | `/api/auth/logout` | Admin sign-out |
| GET | `/api/auth/me` | Check current admin session |
| GET | `/api/leads` | List/search/filter leads (admin) |
| POST | `/api/leads` | Add a lead manually (admin) |
| PATCH | `/api/leads/:id` | Update status/follow-up date (admin) |
| POST | `/api/leads/:id/notes` | Add a note (admin) |
| DELETE | `/api/leads/:id` | Delete a lead (admin) |

## Security and production notes
- Passwords are hashed with bcrypt; sessions are stored in MongoDB.
- Login attempts are rate-limited. Helmet sets common security headers.
- Session cookies are HttpOnly and SameSite=Lax; Secure is enabled in production.
- Use HTTPS in production and set `NODE_ENV=production`.
- Configure a strong, private session secret and admin password.
- This is an internship demonstration, not a security-audited production CRM. Before real client data is used, add CSRF protection, account recovery, audit logging, backups, stricter operational monitoring and a privacy notice/consent process appropriate to the business.
- Do not store real sensitive client data in a public demo.

## Before submission
- Run `npm install` and `npm run check`.
- Test public enquiry submission and every admin workflow locally.
- Capture screenshots of the public form, dashboard, lead status change, notes and follow-up date.
- Replace the demo brand name/content if you are pitching to a real business.
- Push the repository publicly as `FUTURE_FS_02`, as specified in the internship guide.
