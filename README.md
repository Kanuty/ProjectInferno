# Project Inferno - Baseline Infrastructure & Developer Startup Guide

Project Inferno is a reusable baseline monorepo foundation for persistent, asynchronous, world-based strategy games built with Node.js, TypeScript, PostgreSQL, Redis, and React.

---

## 🏗 System Architecture Overview

The repository is structured as a pnpm monorepo following strict architectural boundaries:

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

## 🚀 Quick Start & How to Open/Start Each Part

### Prerequisites
- **Node.js**: v18+ or v20+
- **pnpm**: v8+ or v10+ (`npm install -g pnpm`)
- **Docker & Docker Compose**: For local PostgreSQL and Redis databases

---

### Step 1: Install Dependencies

From the project root, run:
```bash
pnpm install
```

---

### Step 2: Start Database Infrastructure (PostgreSQL & Redis)

Start the PostgreSQL and Redis containers using Docker Compose:
```bash
docker compose up -d
```
This spins up:
- **PostgreSQL**: `localhost:5432` (User: `inferno`, Database: `inferno_db`, Password: `inferno_secret`)
- **Redis**: `localhost:6379`

---

### Step 3: Run Database Migrations

Apply the database schema (creates `users`, `worlds`, `player_bases`, `game_events` tables):
```bash
pnpm --filter @project-inferno/database run build
```
*(When starting the API, database initialization automatically runs migrations if called, or you can invoke `runMigrations()` from `@project-inferno/database`).*

---

### Step 4: Starting backend applications (`apps/api` & `apps/worker`)

#### Option A: Start All Services Concurrently (Recommended for Development)
To start the API backend, Worker, and Web frontend all at once in dev mode:
```bash
pnpm dev
```

#### Option B: Start Services Individually

1. **Start the API Backend Server (`apps/api`)**:
   ```bash
   pnpm --filter @project-inferno/api run dev
   ```
   - Running at: `http://localhost:3000`
   - Health Check: `http://localhost:3000/health`

2. **Start the Background Worker (`apps/worker`)**:
   ```bash
   pnpm --filter @project-inferno/worker run dev
   ```
   - Monitors `game_events` table for due actions using safe `FOR UPDATE SKIP LOCKED` transactions.

---

### Step 5: Starting the Front-End (`apps/web`)

1. **Start the React Web Application**:
   ```bash
   pnpm --filter @project-inferno/web run dev
   ```
   - Running at: `http://localhost:5173`
   - Opens the React app in your browser containing the **Account Shell** and **Game Shell**.

---

## 🧪 Building & Verification Commands

To build all packages and applications across the monorepo:
```bash
pnpm build
```

To run typechecking across all monorepo workspaces:
```bash
pnpm typecheck
```

---

## 📐 Key Architecture Guidelines

1. **PostgreSQL as Authoritative Truth**: All durable state exists in PostgreSQL.
2. **Deterministic Rules**: Domain calculations (e.g. resource generation) live in `packages/game-core` and take explicit timestamps (`effectiveTime`).
3. **No Duplicate DTOs**: Frontend imports response types strictly from `packages/contracts` via `packages/api-client`.
4. **No In-Memory Timers**: Background worker handles scheduled execution using PostgreSQL queues with `SKIP LOCKED`.
