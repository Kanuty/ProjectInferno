-- Project Inferno PostgreSQL Schema

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  terms_accepted_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_activation',
  activation_token VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure existing database instances get missing columns/constraint updates added
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'pending_activation';
ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Seed default super users (Inferno, admin, admin123)
INSERT INTO users (username, email, password_hash, role, status)
VALUES
  ('Inferno', NULL, 'Inferno123', 'super_admin', 'active'),
  ('admin', 'admin@project-inferno.com', 'admin', 'admin', 'active'),
  ('admin123', 'admin123@project-inferno.com', 'admin123', 'admin', 'active')
ON CONFLICT (username) DO UPDATE SET
  role = EXCLUDED.role,
  status = 'active';

-- Case-insensitive unique indexes for strict concurrency protection against duplicate usernames/emails
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_username ON users (LOWER(username));
DROP INDEX IF EXISTS idx_users_lower_email;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email ON users (LOWER(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS worlds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  starts_at TIMESTAMP WITH TIME ZONE,
  max_players INT NOT NULL DEFAULT 100,
  is_test_only BOOLEAN NOT NULL DEFAULT false,
  auto_close_days INT NOT NULL DEFAULT 20,
  auto_close_at TIMESTAMP WITH TIME ZONE,
  map_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE worlds ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS max_players INT NOT NULL DEFAULT 100;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS is_test_only BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS auto_close_days INT NOT NULL DEFAULT 20;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS auto_close_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS map_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE worlds ALTER COLUMN status TYPE VARCHAR(30);

CREATE TABLE IF NOT EXISTS world_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_world_user_reservation UNIQUE (world_id, user_id)
);

CREATE TABLE IF NOT EXISTS player_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for neutral bases
  name VARCHAR(100) NOT NULL,
  q INT NOT NULL DEFAULT 0,
  r INT NOT NULL DEFAULT 0,
  position_x INT NOT NULL DEFAULT 0,
  position_y INT NOT NULL DEFAULT 0,
  tint_race_id VARCHAR(50),
  neutral_origin VARCHAR(50),
  points INT NOT NULL DEFAULT 100,
  resource_amount_at_ref DOUBLE PRECISION NOT NULL DEFAULT 100.0,
  resource_production_rate DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  resource_ref_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resource_capacity DOUBLE PRECISION NOT NULL DEFAULT 10000.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE player_bases ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE player_bases ADD COLUMN IF NOT EXISTS q INT NOT NULL DEFAULT 0;
ALTER TABLE player_bases ADD COLUMN IF NOT EXISTS r INT NOT NULL DEFAULT 0;
ALTER TABLE player_bases ADD COLUMN IF NOT EXISTS position_x INT NOT NULL DEFAULT 0;
ALTER TABLE player_bases ADD COLUMN IF NOT EXISTS position_y INT NOT NULL DEFAULT 0;
ALTER TABLE player_bases ADD COLUMN IF NOT EXISTS tint_race_id VARCHAR(50);
ALTER TABLE player_bases ADD COLUMN IF NOT EXISTS neutral_origin VARCHAR(50);
ALTER TABLE player_bases ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 100;

ALTER TABLE player_bases DROP CONSTRAINT IF EXISTS unique_world_position;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_world_qr'
  ) THEN
    ALTER TABLE player_bases ADD CONSTRAINT unique_world_qr UNIQUE (world_id, q, r);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_player_bases_world_qr ON player_bases (world_id, q, r);
CREATE INDEX IF NOT EXISTS idx_player_bases_world_user ON player_bases (world_id, user_id);

CREATE TABLE IF NOT EXISTS neutral_spawn_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  cycle_number INT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_world_cycle UNIQUE (world_id, cycle_number)
);

CREATE TABLE IF NOT EXISTS game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, CLAIMED, COMPLETED, FAILED, CANCELLED
  execute_at TIMESTAMP WITH TIME ZONE NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_events_due ON game_events (status, execute_at) WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email VARCHAR(255) NOT NULL,
  sender_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'success',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS world_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID REFERENCES worlds(id) ON DELETE SET NULL,
  world_name VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  performed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_by_username VARCHAR(64) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
