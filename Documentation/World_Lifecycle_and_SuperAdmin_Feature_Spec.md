# Project Inferno Specification: World Lifecycle Stages, World Audit Logging & SuperAdmin Architecture

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

## 2. World Lifecycle Stages, Capacity Modifications & Audit Logging

### Overview
Game worlds in Project Inferno transition through distinct lifecycle stages to support future world scheduling, pre-launch player reservations, live gameplay, automated duration timers, and permanent archiving.

### World Audit Logs Retention
1. **Audit Actions Logged**: All world lifecycle actions are recorded in the `world_logs` database table:
   - `CREATED`: Logged when an admin creates a new world.
   - `STATUS_CHANGED`: Logged when world status transitions manually or automatically.
   - `LIMIT_UPDATED`: Logged when player capacity limit (`max_players`) is modified.
   - `SCHEDULE_UPDATED`: Logged when scheduled start time (`starts_at`) is changed.
   - `DELETED`: Logged when an admin completely deletes a world.
2. **Log Retention Guarantee**:
   - `world_logs` rows reference `world_id` via `ON DELETE SET NULL`.
   - When a world is completely deleted from the database, its audit history and creation/modification log entries remain permanently preserved for developer and admin inspection.

### Capacity & Schedule Modifications (Non-Archived Worlds)
- Administrators can update player limits (`max_players`) and scheduled launch dates (`starts_at`) for any existing non-archived world.
- If capacity is increased on a `planned_closed` world, status automatically reverts to `planned_open` if reservation count is below the new limit.
