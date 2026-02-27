# רוקדים 300 — Rokdim 300

Client-server application for the Israeli folk dance initiative **רוקדים 300** (rokdim300.co.il).

## Stack

- **Server:** Node.js, Express, TypeScript, SQLite (better-sqlite3)
- **Client:** Vite, React, TypeScript
- **Auth:** JWT, bcrypt

## Setup

```bash
# Install root + server + client
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Create DB and uploads dir
cd server && npm run db:init && cd ..
```

## Run

```bash
# From repo root: run server + client together
npm run dev
```

- Client: http://localhost:5173  
- Server API: http://localhost:3000  

Or run separately:

```bash
npm run dev:server   # server only, port 3000
npm run dev:client  # client only, port 5173 (proxies /api and /uploads to 3000)
```

## Env (optional)

- **Server:** create `server/.env` with `PORT`, `JWT_SECRET`, `DB_PATH`, `CLIENT_ORIGIN`, `APP_URL` (for reset-password link).
- **Password reset email:** set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and optionally `SMTP_SECURE`, `MAIL_FROM`. If not set, the reset link is returned in the API response (for dev only).
- **Dance admin:** only user `yben99@gmail.com` can add/edit dances (see `server/src/middleware/admin.ts`).
- **Client:** uses Vite proxy to `/api` and `/uploads` when running `npm run dev`.

## Features

- **Landing:** Problem, vision, and first step (Hebrew, RTL).
- **Auth:** Register, login, forgot password, reset password.
- **Profile:** Free text (experience, location, when/where you want to dance, opinions), phone, profile image upload (editable on each visit).
- **DB:** `users` (email, password_hash, phone, free_text, image_path, reset_token), `dances` (name, type, category, difficulty_level, youtube_link). Add dance data later via DB or admin.

## Add dances

Insert into SQLite (e.g. `server/data/rokdim300.db`):

```sql
INSERT INTO dances (name, type, category, difficulty_level, youtube_link, created_at)
VALUES ('ריקוד לדוגמה', 'circle', 'עממי', 'beginner', 'https://youtube.com/...', unixepoch() * 1000);
```

You can add more columns/categories later.
