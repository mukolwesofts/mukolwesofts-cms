# mukolwesofts

A minimal terminal-styled portfolio site with a real CMS backend. Plain HTML/CSS/JS
frontend, Express + SQLite backend. No build step.

## Stack

- **Backend**: Node.js 20+, Express, better-sqlite3, express-session, bcrypt, helmet, express-rate-limit, zod
- **Frontend**: vanilla HTML/CSS/JS, JetBrains Mono, CSS `@layer` (tokens → base → components)
- **DB**: single SQLite file

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
| `DATABASE_PATH`       | no              | default `./data/app.db`                                                                                          |
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

## Deployment

The SQLite file lives at `DATABASE_PATH` — mount persistent storage there.

### Render

1. Push to GitHub, create a **Web Service** → build: `npm install`, start: `npm start`.
2. Add a **Persistent Disk** mounted at `/opt/render/project/src/data`.
3. Env vars: `NODE_ENV=production`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `DATABASE_PATH=/opt/render/project/src/data/app.db`.

### Fly.io

```bash
fly launch            # generates fly.toml; set port 3000
fly volumes create data --size 1   # 1GB volume
fly secrets set ADMIN_PASSWORD_HASH='...' SESSION_SECRET='...' DATABASE_PATH=/data/app.db
fly deploy
```

In `fly.toml` mount the volume: `[[mounts]] source = "data" destination = "/data"`.

### Small VPS

```bash
git clone <repo> && cd mukolwesofts-cms
npm install && cp .env.example .env   # fill in values
npm start                              # or: pm2 start server/index.js --name mukolwesofts
```

Put nginx or Caddy in front for TLS. The `data/` dir holds the SQLite file — back it up
or put it on a mounted volume.

## Notes

- Sessions use the in-memory store; restarting the app logs everyone out (log back in).
- `POST /api/admin/password` rotates the session id on success.
