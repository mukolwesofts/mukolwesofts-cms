# mukolwesofts

A minimal terminal-styled portfolio site with a real CMS backend. Plain HTML/CSS/JS
frontend, Express + SQLite backend. No build step.

## Stack

- **Backend**: Node.js 20+, Express, @libsql/client, express-session, bcrypt, helmet, express-rate-limit, zod
- **Frontend**: vanilla HTML/CSS/JS, JetBrains Mono, CSS `@layer` (tokens → base → components)
- **DB**: SQLite — local file in dev, [Turso](https://turso.tech) in production

## Setup

```bash
npm install
cp .env.example .env
```

Generate your admin password hash and session secret:

```bash
npm run hash-password -- yourpassword       # paste output into ADMIN_PASSWORD_HASH
openssl rand -hex 32                        # paste output into SESSION_SECRET
```

Run it:

```bash
npm run dev        # http://localhost:3000
```

Admin console: **http://localhost:3000/admin** — add/edit/delete/reorder projects,
edit profile/contact content, change your password.

## Environment variables

| Variable              | Required        | Purpose                                                                                                          |
| --------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ADMIN_PASSWORD_HASH` | yes (first run) | bcrypt hash of the admin password. Once changed via /admin, the DB value takes over and this is only a fallback. |
| `SESSION_SECRET`      | yes in prod     | session signing secret                                                                                           |
| `PORT`                | no              | default `3000`                                                                                                   |
| `DATABASE_URL`        | no              | default `file:./data/app.db`; set to `libsql://…turso.io` for Turso                                              |
| `TURSO_AUTH_TOKEN`    | prod only       | Turso database auth token                                                                                        |
| `NODE_ENV`            | no              | set to `production` when deployed — enables secure cookies and `upgrade-insecure-requests`                       |

## API

Public: `GET /api/projects`, `GET /api/profile`
Admin (session cookie + `X-Requested-With: fetch` header):

```
POST   /api/admin/login      {password}
POST   /api/admin/logout
GET    /api/admin/me
POST   /api/admin/password   {current_password, new_password}
POST   /api/projects
PUT    /api/projects/:id
DELETE /api/projects/:id
PUT    /api/projects/reorder {ids:[...]}
PUT    /api/profile
```

Login is rate-limited to 5 attempts / 15 min. All inputs validated with zod.

## Tests

```bash
npm test     # node:test — covers auth, CRUD, reorder, validation, password change
```

## Code style

```bash
npm run format         # prettier --write .
npm run format:check   # verify formatting without writing
npm run lint           # eslint .
```

Prettier config: `.prettierrc.json` (4 spaces, single quotes, 100 cols).

## Deployment — Vercel + Turso (free tier)

The app is serverless-ready: static files serve from `public/`, all `/api/*` traffic
goes through `api/[...slug].js`, and the DB lives on Turso.

### 1. Create a Turso database

```bash
brew install tursodatabase/tap/turso     # or see turso.tech/docs
turso auth signup && turso auth login
turso db create mukolwesofts
turso db show mukolwesofts --url          # libsql://mukolwesofts-xxx.turso.io
turso db tokens create mukolwesofts       # auth token
```

### 2. Deploy to Vercel

```bash
npm i -g vercel
vercel          # link the project
```

Set env vars in the Vercel dashboard (Settings → Environment Variables), or CLI:

```bash
vercel env add DATABASE_URL           # libsql://mukolwesofts-xxx.turso.io
vercel env add TURSO_AUTH_TOKEN
vercel env add SESSION_SECRET
vercel env add ADMIN_PASSWORD_HASH    # optional once you change it via /admin
vercel --prod
```

`vercel.json` handles routing: `/admin` → `admin.html`, everything unmatched → the
terminal-styled `404.html` (served with a 200 status — it's a rewrite, not a true
404; the page is `noindex`).

### Migrating your local data to Turso (optional)

```bash
sqlite3 data/app.db .dump > dump.sql
turso db shell mukolwesofts < dump.sql
```

Or just start fresh — the schema and seed data auto-create on first request.

### Any other Node host (Fly.io, Render, VPS)

The app still runs as a normal Express server (`npm start`). Point `DATABASE_URL`
at either a `file:` path on persistent storage or your Turso URL — no code changes
needed.

## Notes

- Sessions are stored in the `sessions` table — they survive restarts and work on Turso.
- `POST /api/admin/password` rotates the session id on success.
- On Vercel, login rate-limiting uses per-instance memory (resets per cold start) —
  acceptable for a single-admin site.
