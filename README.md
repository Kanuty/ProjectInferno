# Project Inferno - Complete Developer Guide & Setup Checklist

Project Inferno is a reusable baseline monorepo foundation for persistent, asynchronous, world-based strategy games built with Node.js, TypeScript, PostgreSQL, Redis, and React.

---

## 🏗 System Architecture Overview

The repository is structured as a pnpm monorepo with explicit module boundaries and typed contracts:

```
project-inferno/
├── apps/
│   ├── api/          # Express HTTP API (Auth, Worlds, Player Bases, Game Events)
│   ├── worker/       # Asynchronous background worker for durable game events
│   └── web/          # React + Vite frontend application (Account Shell & Game Shell)
├── packages/
│   ├── contracts/    # Shared API transport contracts & error codes (DTOs)
│   ├── game-core/    # Pure, deterministic game business logic (resource rules, time formulas)
│   ├── database/     # PostgreSQL connection pool, schema, & migrations
│   └── api-client/   # Typed HTTP client wrapper for frontend consumption
├── Documentation/    # Comprehensive architecture specification blueprints
└── docker-compose.yml# Containerized PostgreSQL & Redis development services
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18+ or v20+
- **pnpm**: v8+, v10+, or newer (`npm install -g pnpm`)
- **Docker & Docker Compose**: Optional, recommended for PostgreSQL & Redis

---

### Step 1: Install Dependencies

From the project root:
```bash
pnpm install
```

---

### Step 2: Set Up Environment Variables (Optional)

Default connection strings are provided out-of-the-box. You can customize them by creating `.env` files or setting process environment variables:

| Variable | Default Value | Service | Description |
|---|---|---|---|
| `DATABASE_URL` | `postgres://inferno:inferno_secret@localhost:5432/inferno_db` | `@project-inferno/database` | PostgreSQL connection URL |
| `PORT` | `3000` | `@project-inferno/api` | API Server listening port |
| `AUTO_MIGRATE` | `true` | `@project-inferno/api` | Automatically run DB schema migrations on startup |
| `VITE_API_URL` | `http://localhost:3000` | `@project-inferno/web` | Frontend API backend endpoint |

---

### Step 3: Start Infrastructure (PostgreSQL & Redis)

#### Option A: Docker Compose (Recommended)
```bash
docker compose up -d
```
This starts:
- **PostgreSQL**: `localhost:5432` (User: `inferno`, Password: `inferno_secret`, DB: `inferno_db`)
- **Redis**: `localhost:6379`

#### Option B: Local PostgreSQL Setup (Without Docker)
If running a local PostgreSQL server, create the user and database:
```sql
CREATE USER inferno WITH PASSWORD 'inferno_secret';
CREATE DATABASE inferno_db OWNER inferno;
```

---

### Step 4: Run Database Migrations

Build the database package and execute schema initialization:
```bash
pnpm --filter @project-inferno/database run build
```
*(Note: When launching the API backend server, migrations will automatically attempt to run unless `AUTO_MIGRATE=false` is set).*

---

### Step 5: Start Applications

#### Option A: Run All Services Concurrently
Start the API, Worker, and Web frontend all at once:
```bash
pnpm dev
```

#### Option B: Start Services Individually

1. **Start the API Server (`apps/api`)**:
   ```bash
   pnpm --filter @project-inferno/api run dev
   ```
   - Running at: `http://localhost:3000`
   - Health Check: `http://localhost:3000/health`

2. **Start the Background Worker (`apps/worker`)**:
   ```bash
   pnpm --filter @project-inferno/worker run dev
   ```
   - Monitors due actions in `game_events` using PostgreSQL safe row locking (`FOR UPDATE SKIP LOCKED`).

3. **Start the React Web App (`apps/web`)**:
   ```bash
   pnpm --filter @project-inferno/web run dev
   ```
   - Running at: `http://localhost:5173`

---

## 🛡️ Error Handling & Resiliency Features

Project Inferno implements multi-layer error handling across all architectural tiers:

1. **Database Layer (`packages/database`)**:
   - Connection pool background errors are caught with explicit listeners to prevent unhandled process termination.
   - Migration runner catches execution failures and logs actionable diagnostics.

2. **API Backend (`apps/api`)**:
   - `/health` endpoint checks database connectivity dynamically (returns HTTP 200 `connected` or HTTP 503 `disconnected`).
   - Standardized `ApiErrorResponse` payload with strict `ErrorCode` enums on all error routes.
   - Server startup migration gracefully logs warnings if the database is temporarily offline without crashing express initialization.

3. **Worker (`apps/worker`)**:
   - Event processing loop catches database disconnections and logs warnings with automatic retry backoff polling.

4. **API Client (`packages/api-client`)**:
   - Network failure interceptor translates fetch refusal errors into structured `ApiClientError` exceptions.

5. **Frontend UI (`apps/web`)**:
   - Health status component displays live API and database status with clear troubleshooting tips when services are offline.

---

## 🔧 Troubleshooting Common Setup Issues

| Symptom / Issue | Cause | Solution |
|---|---|---|
| `packages/... typecheck: tsc: not found` | Workspace dependencies not installed | Run `pnpm install` at the repository root |
| Health status shows `Database: disconnected` | PostgreSQL container or local service is down | Run `docker compose up -d` or check `DATABASE_URL` |
| `Network request failed: Could not connect to API server` | API backend server is not running | Run `pnpm --filter @project-inferno/api run dev` |
| `Docker container error: failed to mount overlay` | Local Docker daemon overlayfs restriction | Restart Docker service (`sudo systemctl restart docker`) or run local PostgreSQL |

---

## 🧪 Monorepo Verification & Testing

Run full type checking across all workspaces:
```bash
pnpm typecheck
```

Build all workspace packages and applications:
```bash
pnpm build
```

Run unit and integration test suite:
```bash
pnpm test
```
