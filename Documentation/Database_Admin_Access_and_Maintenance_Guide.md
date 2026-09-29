# Project Inferno: Database Access & Administration Guide

This guide provides step-by-step instructions for server hosts and platform administrators to connect to, inspect, and perform manual maintenance on the PostgreSQL database.

---

## 1. Local & Containerized Connection Options

### Option A: Connecting via Docker Container (`psql`)
If Project Inferno is running via Docker Compose (`docker compose up -d`):

1. **Open a shell session into the PostgreSQL container**:
   ```bash
   docker exec -it project-inferno-db-1 psql -U inferno -d inferno_db
   ```
2. **Alternative using process container search**:
   ```bash
   docker exec -it $(docker ps -q -f name=postgres) psql -U inferno -d inferno_db
   ```

### Option B: Connecting via Local PostgreSQL CLI
If running a standalone PostgreSQL instance:
```bash
psql "postgres://inferno:[YOUR_DB_PASSWORD]@localhost:5432/inferno_db"
```

### Option C: Connecting via GUI Clients (pgAdmin, DBeaver, TablePlus)
Configure your GUI client connection parameters as follows:
- **Host**: `localhost` (or server IP)
- **Port**: `5432`
- **Database**: `inferno_db`
- **Username**: `inferno`
- **Password**: `[Configured in environment / docker-compose.yml]`

---

## 2. Inspecting Database Tables & Schema

Once connected to `psql`, use the following meta-commands to inspect the system:

```sql
-- List all tables
\dt

-- Inspect columns and data types of a specific table (e.g. users)
\d users
\d worlds
\d world_logs
\d email_logs

-- Toggle expanded table display for easier reading
\x
```

---

## 3. Common Manual Administrative Queries

### Viewing All Registered Accounts
```sql
SELECT id, username, email, role, status, created_at
FROM users
ORDER BY created_at DESC;
```

### Changing Account Status Manually (e.g. Active to Suspended)
```sql
UPDATE users
SET status = 'suspended', updated_at = NOW()
WHERE username = 'target_username';
```

### Promoting a User Account to Admin
```sql
UPDATE users
SET role = 'admin', updated_at = NOW()
WHERE username = 'target_username';
```

### Inspecting World Audit & Event Logs
```sql
-- View all recorded world lifecycle actions
SELECT world_name, action, performed_by_username, details, created_at
FROM world_logs
ORDER BY created_at DESC;

-- View email audit log
SELECT recipient_email, sender_email, subject, status, sent_at
FROM email_logs
ORDER BY sent_at DESC;
```

### Manually Adjusting World Stage or Capacity Limit
```sql
UPDATE worlds
SET status = 'planned_open', max_players = 200
WHERE id = 'your-world-uuid-here';
```

---

## 4. Database Safety & Input Encoding Principles

1. **UTF-8 Character Support**: PostgreSQL stores text in `UTF-8` encoding out of the box, supporting multi-byte Unicode strings (including Emojis 😃, Devanagari/Hindi, Korean, Chinese, and Cyrillic).
2. **Parameterized Queries**: All Project Inferno application routes use parameterized SQL queries (`$1`, `$2`), protecting the database against SQL injection attempts.
