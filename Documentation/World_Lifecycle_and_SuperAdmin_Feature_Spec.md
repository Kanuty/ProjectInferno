# Project Inferno Specification: World Lifecycle Stages, Tester Roles & SuperAdmin Architecture

## 1. Protected SuperAdmin Architecture

### Overview
Project Inferno provides a top-tier system superuser account (`Inferno`) designed for root platform oversight and developer console management.

### Key Rules & Constraints
1. **Credentials & Seeding**:
   - **Username**: `Inferno`
   - **Password**: `[Configured securely at initial system setup / Environment Variable]`
   - **Email**: `NULL` (No email address associated or required)
   - **Role**: `super_admin`
   - **Status**: `active`
2. **Account Protection Guarantee**:
   - SuperAdmin accounts (`role === 'super_admin'` or `username === 'Inferno'`) are strictly immutable regarding destructive administrative actions.
   - Any attempt by any administrator to **block/suspend** or **delete** a superadmin account will be refused with HTTP 400 `ACTION_NOT_ALLOWED`.
3. **Role Hierarchy & Creation Rules**:
   - Only a **SuperAdmin** (`super_admin`) can create new **SuperAdmin** accounts.
   - **Admins** (`admin` or `super_admin`) can create **Tester** (`tester`), **Admin** (`admin`), or **User** (`user`) accounts manually.

---

## 2. World Lifecycle Stages & Dynamic Automated Worker Transitions

### Overview
Game worlds in Project Inferno transition through distinct lifecycle stages to support future world scheduling, pre-launch player reservations, live gameplay, automated duration timers, and permanent archiving.

### World Stages Reference & Admin Console Descriptions

| Stage Status | Description | Player Capabilities | Automated Transitions |
|---|---|---|---|
| `planned_open` | World is scheduled for a future start date and open for player reservations. | Players can reserve/cancel their slot on the player list. Cannot enter game yet. | Automatically transitions to `planned_closed` when `reservedCount >= max_players`. Automatically transitions to `active` when `starts_at` arrives. |
| `planned_closed` | World is scheduled for a future start date, but reservations are locked due to capacity or admin lock. | Players can see scheduled start date with local timezone display. No new reservations allowed. | Reverts to `planned_open` if a player cancels reservation and `reservedCount < max_players`. Automatically transitions to `active` when `starts_at` arrives. |
| `active` | World is live and fully playable. | Players can register, enter the world, and construct player bases. | Automatically sets `auto_close_at = NOW() + INTERVAL '20 days'`. Automatically transitions to `active_closed` when `auto_close_at` timer elapses. |
| `active_closed` | World is actively running, but closed to new joiners. | Existing registered players can enter and play; no new players can create bases. | Triggered automatically after duration timer (e.g. 20 days) or manually by admin. |
| `suspended` | World game state is frozen in time for maintenance or administrative review. | World is frozen. Event loop processing paused. Players cannot interact. | Manual admin transition. |
| `archived` | World is permanently closed and completed. | Read-only state. No further gameplay or changes allowed. | Manual admin transition. |

### Player Pre-Launch Reservation & Test-Only Worlds
1. **World Scheduling**: Administrators schedule future worlds with start date (`starts_at`), max capacity (`max_players`), auto-close duration (`auto_close_days`), and optional `is_test_only` flag.
2. **Timezone Displays**: Displayed start times automatically render in the client browser's localized timezone (e.g., `UTC`, `America/New_York`).
3. **Test-Only Worlds**: Worlds with `is_test_only = true` are isolated and visible/accessible ONLY to test users (`tester`, `admin`, `super_admin`).
4. **Reservation Workflow**:
   - Players reserve slots in `planned_open` worlds.
   - Dynamic capacity checks automatically lock the world (`planned_closed`) upon reaching `max_players`, and reopen it if slots free up.
