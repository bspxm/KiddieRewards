# AGENTS.md — KiddieRewards

## Project Overview

Family rewards tracking app: parents define tasks and rewards, children earn points by completing tasks, then redeem points for rewards. Three user roles: `parent`, `child`, `admin` (super-admin).

**Stack**: React 19 + Vite 6 + Tailwind CSS 4 (frontend), Express + SQLite (better-sqlite3) (backend), all in a single Node.js process. TypeScript throughout.

**Note**: `socket.io` is listed in `package.json` and as an esbuild external, but is **not actually used** anywhere in the codebase. Socket.IO-related references in env vars (`SOCKET_ORIGINS`) are repurposed for CSRF origin validation.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start full app (Express server + Vite dev middleware) on `:3000` |
| `npm run build` | Build frontend static assets to `dist/` |
| `npm run preview` | Preview production frontend build |
| `npm run lint` | TypeScript type-check (`tsc --noEmit`) |
| `npm run clean` | Remove `dist/` directory |
| `./build-docker.sh [version]` | Build Docker image and export as `.tar.gz` archive |

There are **no unit or integration tests** in this project.

## Architecture

### Monolith with dual-mode server

`server.ts` is the single entry point. It runs:
1. **Express** REST API (`/api/*`)
2. **Vite dev middleware** in development, or **static file serving** from `dist/` in production
3. **SQLite** database (better-sqlite3, synchronous) at `data/kiddie_rewards.db`

The server auto-creates the `data/` directory on startup. Database tables are created via `CREATE TABLE IF NOT EXISTS` inline, with incremental migrations using try/catch `ALTER TABLE` statements at top of `server.ts`.

### Auth Flow

- Login accepts `name@family` format (e.g. `小乐@乐家`) or `admin` for super-admin
- **Session-based JWT**: JWT tokens contain only a `session_id`; user info (id, name, role, familyId, parentId) is stored in an in-memory `sessionStore`. Legacy tokens with embedded user data are still supported for backward compatibility.
- Sessions auto-expire after 24h; a cleanup timer runs every 30 minutes.
- Tokens stored in `localStorage` as `kiddie_token`; user profile stored as `kiddie_user`.
- All `/api/*` routes (except `/api/login`, `/api/register/family`) require `Bearer <token>`
- **Token blacklist** (`tokenBlacklist` Set): `POST /api/logout` adds the token to the blacklist. The middleware checks this before verifying.
- Brute-force protection: 5 attempts per IP+username combo, then 10-minute cooldown
- **JWT_SECRET persistence**: If not set in `.env`, the secret is auto-generated and persisted to `data/.jwt_secret` (mode 0600), so it survives restarts. Without a fixed secret, tokens invalidate on restart.
- **Lazy password upgrade**: Login uses `verifyPassword()` which handles both bcrypt hashes (`$2*` prefix) and plaintext. If a plaintext match succeeds, it immediately hashes and stores the bcrypt version — so plaintext passwords auto-upgrade on first successful login after deployment.

### Security Middleware

1. **HTTP Security Headers** (MED-01): Every response gets `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, and a CSP header.
2. **CSRF Protection** (MED-02): `POST/PUT/DELETE/PATCH` requests are validated against an allowed origins list (hardcoded `localhost:5173`, `localhost:3000`, plus `SOCKET_ORIGINS` env var). **Auto-passes same-host requests** — if `Origin/Referer` host matches `req.host`, it's allowed. This works behind Cloudflare Tunnel or any reverse proxy without config changes.
3. **Trust proxy** is enabled (`app.set('trust proxy', true)`) for real IP detection behind Docker/reverse proxy/Cloudflare.
4. **Client IP detection**: Checks `cf-connecting-ip` header first (Cloudflare), then falls back to `req.ip`.

### Frontend Structure

```
src/
  App.tsx              — Root component; manages auth state, theme, child/parent mode toggle
  main.tsx             — Vite entry point
  types.ts             — Shared TypeScript interfaces
  index.css            — Tailwind + theme CSS
  lib/
    api.ts             — authFetch() wrapper (auto-attaches Bearer token, handles 401 logout via page reload)
    notificationHelper.ts
  hooks/
    useTabState.ts
  components/
    Admin/SuperAdminView.tsx    — admin-only dashboard
    Auth/LoginView.tsx          — login screen
    Parent/ParentView.tsx       — parent management UI
    Child/ChildView.tsx         — simplified child-facing UI
    Layout/Navbar.tsx           — shared navigation bar
    ui/CustomSelect.tsx
```

`BrowserRouter` from react-router-dom is imported and wraps the logged-in view, but **navigation is entirely via conditional rendering** in `App.tsx` — there are no `<Route>` definitions. `react-router-dom` is a dependency but used only for the `<BrowserRouter>` wrapper.

### Backend Modules

```
server/
  auth.ts      — JWT sign/verify (session-based), bcrypt hash/compare, password upgrade helper
  logger.ts    — structured action logging to `logs/<year>/<month>/actions.log`
```

### Data Model (SQLite)

Key tables: `families`, `users`, `reward_rules`, `rewards`, `task_submissions`, `redemption_records`, `point_history`, `notifications`, `server_meta`.

- Users belong to families; children have `parentId` linking to their parent
- `reward_rules` and `rewards` can target all children (`'all'`) or a specific `targetChildId`
- `reward_rules.isRepeating` controls daily vs one-time submission limits
- Demo family "乐家" is seeded on first boot (parent/admin password: `Kiddie@2026!`, configurable via `DEFAULT_PARENT_PASSWORD` and `DEFAULT_ADMIN_PASSWORD` env vars)
- IDs are generated with `Math.random().toString(36).substr(2, 9)` — no UUID library

### Logging

Logs are **JSONL files**, not database rows. Structured as `logs/<year>/<month>/actions.log`. The admin panel reads these via `GET /api/admin/logs?year=...&month=...`. Log values are sanitized (control characters stripped) to preserve JSONL format.

## Gotchas & Non-Obvious Patterns

1. **`tsx` runs the server, not `node`**: `npm run dev` uses `tsx server.ts` directly — TypeScript is executed natively, not compiled first.

2. **Path alias `@/*` resolves to project root** (`.`), not `src/`. See `vite.config.ts` and `tsconfig.json` — imports like `@/server/auth` are valid. The `tsconfig.json` **does** have `paths` configured, but has no `baseUrl`.

3. **DB migrations are fragile**: Schema changes use try/catch `ALTER TABLE` at the top of `server.ts`. New columns must be added there AND default values filled. There is no migration framework. Backfill logic (e.g. populating `familyId` from `parentId`) runs at startup too.

4. **Logs are JSONL files**, not database rows. The `getLogs()` function walks `logs/` recursively and parses all `actions.log` files.

5. **Better-sqlite3 is synchronous** — all DB calls block the event loop. Transactions (`db.transaction()`) are used for compound writes.

6. **Production Docker build uses esbuild** to bundle `server.ts` → `server.js`, not `tsc`. Builder stage uses full `node:22` (not `-slim`) for Python/Make/G++ needed by `better-sqlite3`. Runner stage uses `-slim`. Externals (loaded from `node_modules` at runtime): express, vite, better-sqlite3, socket.io, jsonwebtoken, jws, bcryptjs, cors, dotenv, lodash, ms.

7. **Login is case-insensitive** for both username and family name (`LOWER()` in SQL).

8. **`/api/*` catch-all returns 404 JSON** — placed before the Vite/static middleware, so unknown API paths don't fall through to the SPA.

9. **GEMINI_API_KEY** is injected at build time via Vite's `define` config — it's a compile-time constant, not a runtime env var in the frontend.

10. **HMR is disabled** in Vite config (`server.hmr: false`). Full page reloads on changes.

11. **`initDefaults()` is async but called without await in the sense that `startServer()` awaits it** — password hashing happens before the Express app starts. The `initDefaults` function upgrades old plaintext passwords to bcrypt.

12. **Session store is in-memory only** — sessions are lost on server restart. The JWT itself expires in 24h, and the session TTL is also 24h.

13. **Family deletion cascades manually** — there are no foreign key constraints. The admin delete endpoint manually deletes from reward_rules, rewards, task_submissions, redemption_records, point_history, notifications, users, then families.

14. **Password is required for all users** (min 6 chars), including children. The `add-member` endpoint requires a `password` field.

15. **Task approval/reward redemption reads points from DB, not client input** — the server-side code fetches the actual points value from the database to prevent client-side tampering.

16. **Old `/api/users/child/:id` DELETE redirects** to `/api/users/:id` via 307 redirect for backward compatibility.

## Docker Deployment

- Dockerfile uses Huawei Cloud mirror for base images (China-region optimized)
- npm registry set to `registry.npmmirror.com` during build
- Final image runs as non-root `node` user
- Volumes: `/app/data` (SQLite DB), `/app/logs` (structured logs)
- Health check: `GET /api/health` every 30s (uses `wget`, not `curl`)
- Export workflow: `./build-docker.sh` → `.tar.gz` → `gunzip | docker load`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | No (auto-persisted to `data/.jwt_secret` if absent) | JWT signing key |
| `GEMINI_API_KEY` | No | Gemini AI API (injected at build time via Vite `define`) |
| `SOCKET_ORIGINS` | No | Comma-separated allowed origins for CSRF validation (not actually for Socket.IO) |
| `NODE_ENV` | No | Set to `production` for static serving mode |
| `DEFAULT_PARENT_PASSWORD` | No | Default demo parent password (default: `Kiddie@2026!`) |
| `DEFAULT_ADMIN_PASSWORD` | No | Default super-admin password (default: `Admin@Kiddie2026!`) |
