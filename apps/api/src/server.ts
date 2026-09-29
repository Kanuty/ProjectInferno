import express, { Request, Response, NextFunction, Express } from "express";
import cors from "cors";
import crypto from "crypto";
import {
  ErrorCode,
  ApiErrorResponse,
  HealthCheckResponse,
  UserDto,
  WorldDto,
  BaseDto,
  CheckUsernameResponse,
  AuthResponse,
  EmailLogDto,
  WorldStageStatus,
  WorldLogDto,
  WorldMapConfig,
  MapChunkDto,
  MapOverviewDto,
  JoinWorldResponse,
} from "@project-inferno/contracts";
import { query, runMigrations, getClient } from "@project-inferno/database";
import {
  DEFAULT_WORLD_MAP_CONFIG,
  generateWorldMapPreview,
  selectPlayerSpawnHex,
  HexDistanceService,
  isWithinRadius,
} from "@project-inferno/game-core";

const memoryEmailLogs: EmailLogDto[] = [];
const memoryWorldLogs: WorldLogDto[] = [];

async function logWorldAction(
  worldId: string | null,
  worldName: string,
  action: string,
  performedByUserId: string | null,
  performedByUsername: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  const createdAt = new Date().toISOString();
  try {
    await query(
      `INSERT INTO world_logs (world_id, world_name, action, performed_by_user_id, performed_by_username, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [worldId, worldName, action, performedByUserId, performedByUsername, JSON.stringify(details)]
    );
  } catch {
    memoryWorldLogs.unshift({
      id: crypto.randomUUID(),
      worldId,
      worldName,
      action,
      performedByUsername,
      details,
      createdAt,
    });
  }
}

async function logEmailSent(recipientEmail: string, senderEmail: string, subject: string, status: string = "success"): Promise<void> {
  const sentAt = new Date().toISOString();
  try {
    await query(
      `INSERT INTO email_logs (recipient_email, sender_email, subject, status, sent_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [recipientEmail, senderEmail, subject, status]
    );
  } catch {
    memoryEmailLogs.unshift({
      id: crypto.randomUUID(),
      recipientEmail,
      senderEmail,
      subject,
      status,
      sentAt,
    });
  }
}

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", async (_req: Request, res: Response) => {
  let dbStatus: "connected" | "disconnected" = "disconnected";
  try {
    await query("SELECT 1");
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  const response: HealthCheckResponse = {
    status: dbStatus === "connected" ? "ok" : "error",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    database: dbStatus,
  };

  res.status(dbStatus === "connected" ? 200 : 503).json(response);
});

function cleanInput(val: unknown): string {
  if (typeof val !== "string") return "";
  return val.normalize("NFC").trim();
}

function getCharLength(str: string): number {
  return Array.from(str).length;
}

async function getAuthUser(req: Request): Promise<UserDto | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const userId = token.replace("mock-jwt-token-", "");
  try {
    const dbRes = await query<UserDto>(
      `SELECT id, username, email, status, role, created_at as "createdAt" FROM users WHERE id = $1`,
      [userId]
    );
    return dbRes.rows[0] || null;
  } catch {
    return null;
  }
}

// Auth Routes
app.get("/api/auth/check-username", async (req: Request, res: Response) => {
  const username = cleanInput(req.query.username);
  if (!username || getCharLength(username) < 3) {
    return res.status(400).json({
      available: false,
      message: "Username must be at least 3 characters long.",
    } as CheckUsernameResponse);
  }

  try {
    const dbRes = await query("SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1", [username]);
    if (dbRes.rows.length > 0) {
      return res.json({ available: false, message: "Username is already taken." } as CheckUsernameResponse);
    }
    return res.json({ available: true, message: "Username is available." } as CheckUsernameResponse);
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

app.post("/api/auth/register", async (req: Request, res: Response) => {
  const { termsAccepted } = req.body;
  const username = cleanInput(req.body.username);
  const email = cleanInput(req.body.email);
  const passwordHash = cleanInput(req.body.passwordHash);

  if (!username || !email || !passwordHash) {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "Username, email, and passwordHash are required." } as ApiErrorResponse);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "Please provide a valid email address." } as ApiErrorResponse);
  }

  if (getCharLength(username) < 3) {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "Username must be at least 3 characters long." } as ApiErrorResponse);
  }

  if (getCharLength(passwordHash) < 8) {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "Password must be at least 8 characters long." } as ApiErrorResponse);
  }

  if (termsAccepted === false) {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "You must accept Terms of Service to register." } as ApiErrorResponse);
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");
    const existingCheck = await client.query(
      `SELECT username, email FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) FOR UPDATE`,
      [username, email]
    );

    if (existingCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      const existing = existingCheck.rows[0];
      const field = existing.username.toLowerCase() === username.toLowerCase() ? "username" : "email address";
      return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: `An account with this ${field} already exists.` } as ApiErrorResponse);
    }

    const termsAcceptedAt = termsAccepted ? new Date() : null;
    const activationToken = crypto.randomBytes(32).toString("hex");

    const dbRes = await client.query<UserDto>(
      `INSERT INTO users (username, email, password_hash, terms_accepted_at, status, activation_token)
       VALUES ($1, $2, $3, $4, 'pending_activation', $5)
       RETURNING id, username, email, status, created_at as "createdAt"`,
      [username, email.toLowerCase(), passwordHash, termsAcceptedAt, activationToken]
    );

    await client.query("COMMIT");
    const user = dbRes.rows[0];
    if (user.email) await logEmailSent(user.email, "noreply@project-inferno.com", "Activate your Project Inferno account", "success");

    return res.json({
      token: "",
      user,
      message: "Account created! Please check your inbox for activation instructions.",
    } as AuthResponse);
  } catch (err: any) {
    await client.query("ROLLBACK");
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: err.message || "User registration failed." } as ApiErrorResponse);
  } finally {
    client.release();
  }
});

app.post("/api/auth/activate", async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "Activation token is required." } as ApiErrorResponse);

  try {
    const dbRes = await query<UserDto>(
      `UPDATE users SET status = 'active', activation_token = NULL, updated_at = NOW()
       WHERE activation_token = $1 AND status = 'pending_activation'
       RETURNING id, username, email, status, created_at as "createdAt"`,
      [token]
    );

    if (dbRes.rows.length === 0) {
      return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "Invalid or expired activation link." } as ApiErrorResponse);
    }

    const user = dbRes.rows[0];
    return res.json({ token: `mock-jwt-token-${user.id}`, user, message: "Account successfully activated!" } as AuthResponse);
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const login = cleanInput(req.body.login);
  const passwordHash = cleanInput(req.body.passwordHash);

  if (!login || !passwordHash) {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "Username/Email and password are required." } as ApiErrorResponse);
  }

  try {
    const dbRes = await query<UserDto & { password_hash: string; status: string; role: "super_admin" | "admin" | "user" }>(
      `SELECT id, username, email, status, role, created_at as "createdAt", password_hash
       FROM users WHERE (email IS NOT NULL AND LOWER(email) = LOWER($1)) OR LOWER(username) = LOWER($1)`,
      [login]
    );

    if (dbRes.rows.length === 0 || dbRes.rows[0].password_hash !== passwordHash) {
      return res.status(401).json({ code: ErrorCode.UNAUTHORIZED, message: "Invalid credentials." } as ApiErrorResponse);
    }

    const userRecord = dbRes.rows[0];
    if (userRecord.status !== "active") {
      return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Account is not active." } as ApiErrorResponse);
    }

    const { password_hash, ...user } = userRecord;
    return res.json({ token: `mock-jwt-token-${user.id}`, user });
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: "Login failed." } as ApiErrorResponse);
  }
});

app.get("/api/users/me", async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ code: ErrorCode.UNAUTHORIZED, message: "Unauthorized." } as ApiErrorResponse);
  return res.json(user);
});

// Admin World Creation & Spawn Config Preview Tool
app.post("/api/admin/worlds/preview-generation", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Admin privileges required." } as ApiErrorResponse);
  }

  try {
    const customConfig = req.body.mapConfig || {};
    const preview = generateWorldMapPreview(customConfig);
    return res.json(preview);
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Admin Create World
app.post("/api/admin/worlds", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Admin privileges required." } as ApiErrorResponse);
  }

  const { name, startsAt, maxPlayers, status, isTestOnly, autoCloseDays, config } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "World name is required." } as ApiErrorResponse);
  }

  const initialStatus: WorldStageStatus = status || "planned_open";
  const capacity = maxPlayers && maxPlayers > 0 ? maxPlayers : 100;
  const startDate = startsAt ? new Date(startsAt) : new Date();
  const testOnly = Boolean(isTestOnly);
  const closeDays = autoCloseDays && autoCloseDays > 0 ? autoCloseDays : 20;

  const mapConfig: WorldMapConfig = {
    ...DEFAULT_WORLD_MAP_CONFIG,
    ...config,
  };

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const dbRes = await client.query(
      `INSERT INTO worlds (name, status, starts_at, max_players, is_test_only, auto_close_days, map_config)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, status, starts_at as "startsAt", max_players as "maxPlayers",
                 is_test_only as "isTestOnly", auto_close_days as "autoCloseDays", map_config as "mapConfig", created_at as "createdAt"`,
      [name.trim(), initialStatus, startDate, capacity, testOnly, closeDays, JSON.stringify(mapConfig)]
    );

    const createdWorld = dbRes.rows[0];

    // Seed background initial neutrals
    const preview = generateWorldMapPreview(mapConfig);
    for (const hex of preview.initialNeutrals) {
      await client.query(
        `INSERT INTO player_bases (world_id, user_id, name, q, r, neutral_origin, points)
         VALUES ($1, NULL, 'Abandoned Village', $2, $3, 'GENERATED_INITIAL', 100)
         ON CONFLICT (world_id, q, r) DO NOTHING`,
        [createdWorld.id, hex.q, hex.r]
      );
    }

    // Schedule first NEUTRAL_SPAWN_CYCLE game event if periodic spawning enabled
    if (mapConfig.periodicSpawnIntervalDays > 0 && mapConfig.periodicSpawnCutoffDays > 0) {
      const executeAt = new Date(startDate.getTime() + mapConfig.periodicSpawnIntervalDays * 86400 * 1000);
      await client.query(
        `INSERT INTO game_events (world_id, event_type, execute_at, payload, status)
         VALUES ($1, 'NEUTRAL_SPAWN_CYCLE', $2, $3, 'PENDING')`,
        [createdWorld.id, executeAt, JSON.stringify({ worldId: createdWorld.id, cycleNumber: 1 })]
      );
    }

    await client.query("COMMIT");

    await logWorldAction(createdWorld.id, createdWorld.name, "CREATED", authUser.id, authUser.username, {
      status: createdWorld.status,
      maxPlayers: createdWorld.maxPlayers,
      mapConfig: createdWorld.mapConfig,
    });

    return res.json(createdWorld);
  } catch (err: any) {
    await client.query("ROLLBACK");
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  } finally {
    client.release();
  }
});

// Admin Update World Status
app.patch("/api/admin/worlds/:id/status", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Admin privileges required." } as ApiErrorResponse);
  }

  const { id } = req.params;
  const { status } = req.body;

  try {
    const dbRes = await query(
      `UPDATE worlds SET status = $1 WHERE id = $2
       RETURNING id, name, status, starts_at as "startsAt", max_players as "maxPlayers", map_config as "mapConfig", created_at as "createdAt"`,
      [status, id]
    );

    if (dbRes.rows.length === 0) {
      return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "World not found." } as ApiErrorResponse);
    }

    const updatedWorld = dbRes.rows[0];
    await logWorldAction(updatedWorld.id, updatedWorld.name, "STATUS_CHANGED", authUser.id, authUser.username, { newStatus: status });
    return res.json(updatedWorld);
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Admin Delete World
app.delete("/api/admin/worlds/:id", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Admin privileges required." } as ApiErrorResponse);
  }

  const { id } = req.params;
  try {
    const worldRes = await query("SELECT id, name, status FROM worlds WHERE id = $1", [id]);
    if (worldRes.rows.length === 0) {
      return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "World not found." } as ApiErrorResponse);
    }
    const world = worldRes.rows[0];
    await logWorldAction(world.id, world.name, "DELETED", authUser.id, authUser.username, {});
    await query("DELETE FROM worlds WHERE id = $1", [id]);
    return res.json({ message: `World '${world.name}' deleted.` });
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// World Reservations
app.post("/api/worlds/:id/reserve", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ code: ErrorCode.UNAUTHORIZED, message: "Login required." } as ApiErrorResponse);

  const { id } = req.params;
  try {
    const worldRes = await query("SELECT id, status, max_players as \"maxPlayers\" FROM worlds WHERE id = $1", [id]);
    if (worldRes.rows.length === 0) return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "World not found." } as ApiErrorResponse);

    const world = worldRes.rows[0];
    if (world.status !== "planned_open") {
      return res.status(400).json({ code: ErrorCode.ACTION_NOT_ALLOWED, message: "Reservations only allowed when planned_open." } as ApiErrorResponse);
    }

    await query("INSERT INTO world_reservations (world_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, authUser.id]);
    return res.json({ message: "Reserved successfully." });
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Join World & Spawn Player Base (Atomic Reservation of Player Start + 2 Guaranteed Neutrals)
app.post("/api/worlds/:worldId/join", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ code: ErrorCode.UNAUTHORIZED, message: "Login required." } as ApiErrorResponse);

  const { worldId } = req.params;
  const { tintRaceId } = req.body;

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const worldRes = await client.query("SELECT id, name, status, map_config FROM worlds WHERE id = $1 FOR UPDATE", [worldId]);
    if (worldRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "World not found." } as ApiErrorResponse);
    }

    const world = worldRes.rows[0];
    if (world.status !== "active" && world.status !== "active_closed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ code: ErrorCode.ACTION_NOT_ALLOWED, message: "World is not currently active for joining." } as ApiErrorResponse);
    }

    // Check if user already has a base in this world
    const existingPlayerBase = await client.query("SELECT id FROM player_bases WHERE world_id = $1 AND user_id = $2 LIMIT 1", [worldId, authUser.id]);
    if (existingPlayerBase.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ code: ErrorCode.ACTION_NOT_ALLOWED, message: "You already have a base in this world." } as ApiErrorResponse);
    }

    const mapConfig: WorldMapConfig = { ...DEFAULT_WORLD_MAP_CONFIG, ...world.map_config };

    // Fetch all existing occupied hexes in this world
    const allBasesRes = await client.query("SELECT q, r, user_id FROM player_bases WHERE world_id = $1", [worldId]);
    const occupiedHexes = new Set<string>();
    const existingPlayerHexes: { q: number; r: number }[] = [];
    const existingNeutralHexes: { q: number; r: number }[] = [];

    for (const b of allBasesRes.rows) {
      occupiedHexes.add(`${b.q},${b.r}`);
      if (b.user_id) {
        existingPlayerHexes.push({ q: b.q, r: b.r });
      } else {
        existingNeutralHexes.push({ q: b.q, r: b.r });
      }
    }

    // Run player spawn selection
    const spawnSelection = selectPlayerSpawnHex(mapConfig, occupiedHexes, existingPlayerHexes, existingNeutralHexes);
    if (!spawnSelection) {
      await client.query("ROLLBACK");
      return res.status(400).json({ code: ErrorCode.ACTION_NOT_ALLOWED, message: "No available spawn location remaining in this world." } as ApiErrorResponse);
    }

    // Insert Player Base
    const playerBaseName = `${authUser.username}'s Village`;
    const playerBaseRes = await client.query(
      `INSERT INTO player_bases (world_id, user_id, name, q, r, tint_race_id, points)
       VALUES ($1, $2, $3, $4, $5, $6, 100)
       RETURNING id, world_id as "worldId", user_id as "userId", name, q, r,
                 tint_race_id as "tintRaceId", neutral_origin as "neutralOrigin", points, created_at as "createdAt"`,
      [worldId, authUser.id, playerBaseName, spawnSelection.playerHex.q, spawnSelection.playerHex.r, tintRaceId || null]
    );

    const playerBase: BaseDto = {
      ...playerBaseRes.rows[0],
      ownerUsername: authUser.username,
      resources: {
        amountAtReference: 100,
        productionRate: 1,
        referenceAt: new Date().toISOString(),
        capacity: 10000,
      },
    };

    // Insert Guaranteed Neutrals
    const guaranteedNeutrals: BaseDto[] = [];
    for (let i = 0; i < spawnSelection.guaranteedNeutrals.length; i++) {
      const nHex = spawnSelection.guaranteedNeutrals[i];
      const neutralRes = await client.query(
        `INSERT INTO player_bases (world_id, user_id, name, q, r, neutral_origin, points)
         VALUES ($1, NULL, 'Abandoned Village', $2, $3, 'GENERATED_START_GUARANTEE', 100)
         ON CONFLICT (world_id, q, r) DO NOTHING
         RETURNING id, world_id as "worldId", user_id as "userId", name, q, r,
                   neutral_origin as "neutralOrigin", points, created_at as "createdAt"`,
        [worldId, nHex.q, nHex.r]
      );

      if (neutralRes.rows.length > 0) {
        guaranteedNeutrals.push({
          ...neutralRes.rows[0],
          ownerUsername: null,
          resources: {
            amountAtReference: 100,
            productionRate: 1,
            referenceAt: new Date().toISOString(),
            capacity: 10000,
          },
        });
      }
    }

    await client.query("COMMIT");

    return res.json({
      message: spawnSelection.warning || "Successfully joined world!",
      playerBase,
      guaranteedNeutrals,
    } as JoinWorldResponse);
  } catch (err: any) {
    await client.query("ROLLBACK");
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  } finally {
    client.release();
  }
});

// Map Chunk Endpoint (GET /api/worlds/:worldId/map/chunks?qMin=...&qMax=...&rMin=...&rMax=...)
app.get("/api/worlds/:worldId/map/chunks", async (req: Request, res: Response) => {
  const { worldId } = req.params;
  const qMin = parseInt(req.query.qMin as string, 10) || -15;
  const qMax = parseInt(req.query.qMax as string, 10) || 15;
  const rMin = parseInt(req.query.rMin as string, 10) || -15;
  const rMax = parseInt(req.query.rMax as string, 10) || 15;

  try {
    const dbRes = await query(
      `SELECT b.id, b.world_id as "worldId", b.user_id as "userId", u.username as "ownerUsername",
              b.name, b.q, b.r, b.tint_race_id as "tintRaceId", b.neutral_origin as "neutralOrigin",
              b.points, b.resource_amount_at_ref as "resourceAmountAtRef",
              b.resource_production_rate as "resourceProductionRate",
              b.resource_ref_at as "resourceRefAt", b.resource_capacity as "resourceCapacity",
              b.created_at as "createdAt"
       FROM player_bases b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.world_id = $1 AND b.q >= $2 AND b.q <= $3 AND b.r >= $4 AND b.r <= $5`,
      [worldId, qMin, qMax, rMin, rMax]
    );

    const settlements: BaseDto[] = dbRes.rows.map((row) => ({
      id: row.id,
      worldId: row.worldId,
      userId: row.userId,
      ownerUsername: row.ownerUsername,
      name: row.name,
      q: row.q,
      r: row.r,
      tintRaceId: row.tintRaceId,
      neutralOrigin: row.neutralOrigin,
      points: row.points,
      resources: {
        amountAtReference: row.resourceAmountAtRef,
        productionRate: row.resourceProductionRate,
        referenceAt: row.resourceRefAt,
        capacity: row.resourceCapacity,
      },
      createdAt: row.createdAt,
    }));

    const chunkDto: MapChunkDto = {
      chunkKey: `${qMin}_${qMax}_${rMin}_${rMax}`,
      qMin,
      qMax,
      rMin,
      rMax,
      settlements,
      version: 1,
    };

    return res.json(chunkDto);
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Minimap / World Overview Endpoint
app.get("/api/worlds/:worldId/map/overview", async (req: Request, res: Response) => {
  const { worldId } = req.params;

  try {
    const worldRes = await query("SELECT id, map_config FROM worlds WHERE id = $1", [worldId]);
    if (worldRes.rows.length === 0) {
      return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "World not found." } as ApiErrorResponse);
    }

    const world = worldRes.rows[0];
    const mapConfig: WorldMapConfig = { ...DEFAULT_WORLD_MAP_CONFIG, ...world.map_config };

    const dbRes = await query(
      `SELECT b.id, b.q, b.r, b.user_id as "userId", u.username as "ownerUsername",
              b.tint_race_id as "tintRaceId", b.name
       FROM player_bases b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.world_id = $1`,
      [worldId]
    );

    const settlements = dbRes.rows.map((row) => ({
      id: row.id,
      q: row.q,
      r: row.r,
      userId: row.userId,
      ownerUsername: row.ownerUsername,
      isNeutral: !row.userId,
      tintRaceId: row.tintRaceId,
      name: row.name,
    }));

    const overviewDto: MapOverviewDto = {
      worldId,
      radius: mapConfig.radius,
      settlements,
    };

    return res.json(overviewDto);
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Worlds Route
app.get("/api/worlds", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  try {
    const dbRes = await query(
      `SELECT w.id, w.name, w.status, w.starts_at as "startsAt", w.max_players as "maxPlayers",
              w.is_test_only as "isTestOnly", w.auto_close_days as "autoCloseDays",
              w.map_config as "config", w.created_at as "createdAt",
              COALESCE(r.reserved_count, 0)::int as "reservedCount",
              CASE WHEN my_r.user_id IS NOT NULL THEN true ELSE false END as "isReservedByMe"
       FROM worlds w
       LEFT JOIN (SELECT world_id, COUNT(*) as reserved_count FROM world_reservations GROUP BY world_id) r ON w.id = r.world_id
       LEFT JOIN world_reservations my_r ON w.id = my_r.world_id AND my_r.user_id = $1
       ORDER BY w.created_at DESC`,
      [authUser?.id || null]
    );

    const isTester = authUser && (authUser.role === "tester" || authUser.role === "admin" || authUser.role === "super_admin");
    const filteredRows = dbRes.rows.filter((w) => !w.isTestOnly || isTester);

    return res.json(filteredRows);
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Player Bases Legacy Endpoint
app.get("/api/worlds/:worldId/bases", async (req: Request, res: Response) => {
  const { worldId } = req.params;
  try {
    const dbRes = await query(
      `SELECT b.id, b.world_id as "worldId", b.user_id as "userId", u.username as "ownerUsername",
              b.name, b.q, b.r, b.tint_race_id as "tintRaceId", b.neutral_origin as "neutralOrigin",
              b.points, b.resource_amount_at_ref as "resourceAmountAtRef",
              b.resource_production_rate as "resourceProductionRate",
              b.resource_ref_at as "resourceRefAt", b.resource_capacity as "resourceCapacity",
              b.created_at as "createdAt"
       FROM player_bases b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.world_id = $1`,
      [worldId]
    );

    const bases: BaseDto[] = dbRes.rows.map((row) => ({
      id: row.id,
      worldId: row.worldId,
      userId: row.userId,
      ownerUsername: row.ownerUsername,
      name: row.name,
      q: row.q,
      r: row.r,
      tintRaceId: row.tintRaceId,
      neutralOrigin: row.neutralOrigin,
      points: row.points,
      resources: {
        amountAtReference: row.resourceAmountAtRef,
        productionRate: row.resourceProductionRate,
        referenceAt: row.resourceRefAt,
        capacity: row.resourceCapacity,
      },
      createdAt: row.createdAt,
    }));

    return res.json(bases);
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Error Handling Middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: "Internal server error" } as ApiErrorResponse);
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, async () => {
    console.log(`API Server listening on port ${PORT}`);
    if (process.env.AUTO_MIGRATE !== "false") {
      try {
        await runMigrations();
      } catch (err: any) {
        console.warn("[API] Startup database migration skipped or failed:", err.message || err);
      }
    }
  });
}

export { app };
