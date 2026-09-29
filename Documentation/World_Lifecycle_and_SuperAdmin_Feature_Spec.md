# Project Inferno Specification: World Lifecycle Stages & SuperAdmin Architecture

## 1. Protected SuperAdmin Architecture

### Overview
Project Inferno provides a top-tier system superuser account (`Inferno`) designed for root platform oversight and developer console management.

### Key Rules & Constraints
1. **Credentials & Seeding**:
   - **Username**: `Inferno`
   - **Password**: `Inferno123`
   - **Email**: `NULL` (No email address associated or required)
   - **Role**: `super_admin`
   - **Status**: `active`
2. **Account Protection Guarantee**:
   - SuperAdmin accounts (`role === 'super_admin'` or `username === 'Inferno'`) are strictly immutable regarding destructive administrative actions.
   - Any attempt by any administrator (including other admins) to **block/suspend** or **delete** a superadmin account will be refused with HTTP 400 `ACTION_NOT_ALLOWED`.
3. **Manual User Creation**:
   - Administrators (`admin` or `super_admin`) have the ability to manually create new accounts directly from the Admin Dashboard.
   - Created accounts can have custom usernames, passwords, optional email addresses, and roles (`user`, `admin`, or `super_admin`).

---

## 2. World Lifecycle Stages & Reservation System

### Overview
Game worlds in Project Inferno transition through distinct lifecycle stages to support future world scheduling, pre-launch player reservations, live gameplay, maintenance, and permanent archiving.

### World Stages Reference & Admin Console Descriptions

| Stage Status | Description | Player Capabilities |
|---|---|---|
| `planned_open` | World is scheduled for a future start date and open for player reservations. | Players can reserve/cancel their slot on the player list. Cannot enter game yet. |
| `planned_closed` | World is scheduled for a future start date, but reservations are locked. | Players can see scheduled start date. No new reservations allowed. Cannot enter game yet. |
| `active` | World is live and fully playable. | Players can register, enter the world, and construct player bases. |
| `active_closed` | World is actively running, but closed to new joiners. | Existing registered players can enter and play; new joiners cannot create bases. |
| `suspended` | World game state is frozen in time for maintenance or administrative review. | World is frozen. Event loop processing paused. Players cannot interact. |
| `archived` | World is permanently closed and completed. | Read-only state. No further gameplay or changes allowed. |

### Player Pre-Launch Reservation Workflow
1. Administrators schedule a future empty world in `planned_open` stage with a specified start time (`starts_at`) and max player capacity (`max_players`).
2. Logged-in players view scheduled worlds in their Account Dashboard and click **"Reserve Right to Play"**.
3. The API records the reservation in the `world_reservations` table and increments the `reservedCount`.
4. Players can cancel their reservation prior to world launch.
