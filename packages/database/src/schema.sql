-- Project Inferno PostgreSQL Schema

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  terms_accepted_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_activation',
  activation_token VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure existing database instances get missing columns added
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'pending_activation';
ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Seed default super user (admin / admin)
INSERT INTO users (username, email, password_hash, role, status)
VALUES ('admin', 'admin@project-inferno.com', 'admin', 'admin', 'active')
ON CONFLICT (username) DO UPDATE SET
  role = 'admin',
  status = 'active';

-- Case-insensitive unique indexes for strict concurrency protection against duplicate usernames/emails
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_username ON users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS worlds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  position_x INT NOT NULL,
  position_y INT NOT NULL,
  resource_amount_at_ref DOUBLE PRECISION NOT NULL DEFAULT 100.0,
  resource_production_rate DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  resource_ref_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resource_capacity DOUBLE PRECISION NOT NULL DEFAULT 10000.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_world_position UNIQUE (world_id, position_x, position_y)
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
CREATE INDEX IF NOT EXISTS idx_player_bases_world_user ON player_bases (world_id, user_id);
