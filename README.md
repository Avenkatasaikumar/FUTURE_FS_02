# Mini CRM: Client Lead Management System

A small CRM that captures leads from a website contact form and lets an admin track them from first contact to client. Built for the Future Interns Full Stack Web Development internship (Task 2).

## Features
- Public contact form (`/contact`) that creates leads through the API
- Secure admin login (JWT, bcrypt-hashed password); every admin route is protected
- Lead list with name, email, source, status and received time
- Status workflow: new, contacted, converted
- Notes and follow-up dates on every lead, each with a timestamp
- Search by name, email or source, and filter by status
- Stats: total leads, count per status, conversion rate

## Tech stack
React (Vite), Node.js, Express, MongoDB (Mongoose), JWT

## Setup
Requirements: Node 18+ and a MongoDB instance (local or Atlas).

```bash
# 1. API
cd server
cp .env.example .env      # then edit MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm run dev               # http://localhost:5000, creates the admin account on first start

# 2. Frontend (new terminal)
cd client
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

- Admin dashboard: http://localhost:5173 (sign in with ADMIN_EMAIL / ADMIN_PASSWORD)
- Contact form: http://localhost:5173/contact

## API
| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | /api/auth/login | public | Get a JWT |
| POST | /api/leads | public | Create a lead (contact form) |
| GET | /api/leads?status=&q= | admin | List, search, filter |
| PATCH | /api/leads/:id | admin | Update status |
| POST | /api/leads/:id/notes | admin | Add note with optional follow-up date |
| DELETE | /api/leads/:id | admin | Delete a lead |
| GET | /api/stats | admin | Totals and conversion rate |

Any website can send leads by POSTing `{ name, email, phone, message, source }` to `/api/leads`.

## Ideas for next steps
Rate limiting on the public endpoint, email alerts for new leads, CSV export, a follow-ups due today view.
