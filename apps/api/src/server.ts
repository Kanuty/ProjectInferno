import express, { Request, Response, NextFunction, Express } from "express";
import cors from "cors";
import crypto from "crypto";
import {
  ErrorCode,
  ApiErrorResponse,
  HealthCheckResponse,
  UserDto,
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
  generateCosmeticTerrainFeatures,
  isValidPlayableRace,
  NEUTRAL_RACE_ID,
  getInitialBaseBuildings,
  getInitialResourceStorages,
  calculateBaseResources,
  calculateResources,
  buildBaseBuildingsDtos,
  checkBuildingPrerequisites,
  calculateBuildingUpgradeCost,
  BUILDING_DEFINITIONS,
  CANONICAL_BUILDING_IDS,
  ALL_RESOURCE_TYPES,
} from "@project-inferno/game-core";
import {
  BuildingTypeId,
  ResourceType,
  ResourceStorageDto,
  BaseBuildingDto,
  UpgradeBuildingResponse,
} from "@project-inferno/contracts";

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

async function execQuery(executor: any, sql: string, params?: any[]) {
  if (typeof executor === "function") {
    return await executor(sql, params);
  }
  return await executor.query(sql, params);
}

async function ensureBaseInitialData(dbExecutor: any, baseId: string, tintRaceId?: string | null): Promise<void> {
  // Check if base_buildings initialized
  const buildCheck = await execQuery(
    dbExecutor,
    `SELECT COUNT(*)::int as count FROM base_buildings WHERE base_id = $1`,
    [baseId]
  );
  if (buildCheck.rows[0].count === 0) {
    const initialBuildings = getInitialBaseBuildings();
    for (const bType of CANONICAL_BUILDING_IDS) {
      const level = initialBuildings[bType] || 0;
      await execQuery(
        dbExecutor,
        `INSERT INTO base_buildings (base_id, building_type, level)
         VALUES ($1, $2, $3)
         ON CONFLICT (base_id, building_type) DO NOTHING`,
        [baseId, bType, level]
      );
    }
  }

  // Check if base_resources initialized
  const resCheck = await execQuery(
    dbExecutor,
    `SELECT COUNT(*)::int as count FROM base_resources WHERE base_id = $1`,
    [baseId]
  );
  if (resCheck.rows[0].count === 0) {
    const initialResources = getInitialResourceStorages(0, 200);
    const nowIso = new Date().toISOString();
    for (const rType of ALL_RESOURCE_TYPES) {
      const rStorage = initialResources[rType];
      await execQuery(
        dbExecutor,
        `INSERT INTO base_resources (base_id, resource_type, amount, production_rate, capacity, ref_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (base_id, resource_type) DO NOTHING`,
        [baseId, rType, rStorage.amount, rStorage.productionRate, rStorage.capacity, nowIso]
      );
    }
  }
}

async function getVillageBuildingsMap(dbExecutor: any, baseId: string): Promise<Record<BuildingTypeId, number>> {
  const dbRes = await execQuery(
    dbExecutor,
    `SELECT building_type as "buildingType", level FROM base_buildings WHERE base_id = $1`,
    [baseId]
  );

  const map = {} as Record<BuildingTypeId, number>;
  for (const bId of CANONICAL_BUILDING_IDS) {
    map[bId] = 0;
  }

  for (const row of dbRes.rows) {
    if (row.buildingType in map) {
      map[row.buildingType as BuildingTypeId] = Number(row.level);
    }
  }

  return map;
}

async function getVillageResourcesMap(dbExecutor: any, baseId: string): Promise<Partial<Record<ResourceType, ResourceStorageDto>>> {
  const dbRes = await execQuery(
    dbExecutor,
    `SELECT resource_type as "resourceType", amount, production_rate as "productionRate",
            capacity, ref_at as "referenceAt"
     FROM base_resources WHERE base_id = $1`,
    [baseId]
  );

  const map: Partial<Record<ResourceType, ResourceStorageDto>> = {};
  for (const row of dbRes.rows) {
    map[row.resourceType as ResourceType] = {
      resourceType: row.resourceType,
      amount: Number(row.amount),
      productionRate: Number(row.productionRate),
      capacity: Number(row.capacity),
      referenceAt: new Date(row.referenceAt).toISOString(),
    };
  }

  return map;
}

async function updateAndSaveVillageResources(
  dbExecutor: any,
  baseId: string,
  effectiveTime: Date = new Date()
): Promise<Record<ResourceType, ResourceStorageDto>> {
  const baseRes = await execQuery(dbExecutor, `SELECT tint_race_id FROM player_bases WHERE id = $1`, [baseId]);
  const tintRaceId = baseRes.rows[0]?.tint_race_id || null;

  await ensureBaseInitialData(dbExecutor, baseId, tintRaceId);

  const buildings = await getVillageBuildingsMap(dbExecutor, baseId);
  const currentStorages = await getVillageResourcesMap(dbExecutor, baseId);

  const updatedStorages = calculateBaseResources({
    buildings,
    tintRaceId,
    currentStorages,
    effectiveTime,
  });

  const effIso = effectiveTime.toISOString();
  for (const rType of ALL_RESOURCE_TYPES) {
    const s = updatedStorages[rType];
    await execQuery(
      dbExecutor,
      `INSERT INTO base_resources (base_id, resource_type, amount, production_rate, capacity, ref_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (base_id, resource_type) DO UPDATE SET
         amount = EXCLUDED.amount,
         production_rate = EXCLUDED.production_rate,
         capacity = EXCLUDED.capacity,
         ref_at = EXCLUDED.ref_at`,
      [baseId, rType, s.amount, s.productionRate, s.capacity, effIso]
    );
  }

  // Sync legacy columns in player_bases
  const matStorage = updatedStorages["BUILDING_MATERIAL"];
  if (matStorage) {
    await execQuery(
      dbExecutor,
      `UPDATE player_bases
       SET resource_amount_at_ref = $1, resource_production_rate = $2, resource_capacity = $3, resource_ref_at = $4
       WHERE id = $5`,
      [matStorage.amount, matStorage.productionRate, matStorage.capacity, effIso, baseId]
    );
  }

  return updatedStorages;
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
       RETURNING id, username, email, status, role, created_at as "createdAt"`,
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
       RETURNING id, username, email, status, role, created_at as "createdAt"`,
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
    if (userRecord.status === "pending_activation") {
      return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Account is not activated yet." } as ApiErrorResponse);
    }

    if (userRecord.status !== "active") {
      return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Account is suspended or inactive." } as ApiErrorResponse);
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

// Forgot Password
app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "Email address is required." } as ApiErrorResponse);
  }

  try {
    const dbRes = await query("SELECT id, username, email FROM users WHERE LOWER(email) = LOWER($1)", [email.trim()]);
    if (dbRes.rows.length > 0) {
      const user = dbRes.rows[0];
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 3600 * 1000);

      await query(
        `UPDATE users SET reset_token = $1, reset_token_expires_at = $2, updated_at = NOW() WHERE id = $3`,
        [resetToken, expiresAt, user.id]
      );
      if (user.email) await logEmailSent(user.email, "security@project-inferno.com", "Password Reset Request", "success");
    }

    return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Reset Password
app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
  const { token, newPasswordHash } = req.body;
  if (!token || !newPasswordHash) {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "Reset token and new password are required." } as ApiErrorResponse);
  }

  if (newPasswordHash.length < 8) {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "Password must be at least 8 characters long." } as ApiErrorResponse);
  }

  try {
    const dbRes = await query(
      `UPDATE users
       SET password_hash = $1, reset_token = NULL, reset_token_expires_at = NULL, updated_at = NOW()
       WHERE reset_token = $2 AND reset_token_expires_at > NOW()
       RETURNING id, username, email`,
      [newPasswordHash, token]
    );

    if (dbRes.rows.length === 0) {
      return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "Invalid or expired password reset token." } as ApiErrorResponse);
    }

    return res.json({ message: "Password reset successful!" });
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Admin Get All Users
app.get("/api/admin/users", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Admin privileges required." } as ApiErrorResponse);
  }

  try {
    const dbRes = await query<UserDto>(
      `SELECT id, username, email, status, role, created_at as "createdAt" FROM users ORDER BY created_at DESC`
    );
    return res.json(dbRes.rows);
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Admin Manual Create User
app.post("/api/admin/users", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Admin privileges required." } as ApiErrorResponse);
  }

  const username = cleanInput(req.body.username);
  const passwordHash = cleanInput(req.body.passwordHash);
  const email = cleanInput(req.body.email);
  const role = req.body.role;

  if (!username || !passwordHash) {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "Username and passwordHash are required." } as ApiErrorResponse);
  }

  if (getCharLength(username) < 3) {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "Username must be at least 3 characters long." } as ApiErrorResponse);
  }

  if (role === "super_admin" && authUser.role !== "super_admin") {
    return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Only a Super Admin can create other Super Admin accounts." } as ApiErrorResponse);
  }

  const targetRole = role === "super_admin" ? "super_admin" : role === "admin" ? "admin" : role === "tester" ? "tester" : "user";
  const userEmail = email ? email.toLowerCase() : null;

  try {
    const dbRes = await query<UserDto>(
      `INSERT INTO users (username, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, username, email, status, role, created_at as "createdAt"`,
      [username, userEmail, passwordHash, targetRole]
    );

    return res.json(dbRes.rows[0]);
  } catch (err: any) {
    let message = err.message || "Failed to create user.";
    if (err.code === "23505") message = "An account with this username or email already exists.";
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message } as ApiErrorResponse);
  }
});

// Admin Block/Unblock User
app.post("/api/admin/users/:id/block", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Admin privileges required." } as ApiErrorResponse);
  }

  const { id } = req.params;
  const { status } = req.body;

  if (status !== "active" && status !== "suspended") {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "Status must be 'active' or 'suspended'." } as ApiErrorResponse);
  }

  if (id === authUser.id) {
    return res.status(400).json({ code: ErrorCode.ACTION_NOT_ALLOWED, message: "You cannot change your own account status." } as ApiErrorResponse);
  }

  const targetUserCheck = await query<UserDto>("SELECT id, username, role FROM users WHERE id = $1", [id]);
  if (targetUserCheck.rows.length > 0) {
    const target = targetUserCheck.rows[0];
    if (target.role === "super_admin" || target.username.toLowerCase() === "inferno") {
      return res.status(400).json({ code: ErrorCode.ACTION_NOT_ALLOWED, message: "Superuser (Inferno) account is protected and cannot be blocked." } as ApiErrorResponse);
    }
  }

  try {
    const dbRes = await query<UserDto>(
      `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, email, status, role, created_at as "createdAt"`,
      [status, id]
    );

    if (dbRes.rows.length === 0) return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "User not found." } as ApiErrorResponse);
    return res.json(dbRes.rows[0]);
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Admin Delete User
app.delete("/api/admin/users/:id", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Admin privileges required." } as ApiErrorResponse);
  }

  const { id } = req.params;
  if (id === authUser.id) return res.status(400).json({ code: ErrorCode.ACTION_NOT_ALLOWED, message: "You cannot delete your own account." } as ApiErrorResponse);

  const targetUserCheck = await query<UserDto>("SELECT id, username, role FROM users WHERE id = $1", [id]);
  if (targetUserCheck.rows.length > 0) {
    const target = targetUserCheck.rows[0];
    if (target.role === "super_admin" || target.username.toLowerCase() === "inferno") {
      return res.status(400).json({ code: ErrorCode.ACTION_NOT_ALLOWED, message: "Superuser account is protected and cannot be deleted." } as ApiErrorResponse);
    }
  }

  try {
    const dbRes = await query<UserDto>(`DELETE FROM users WHERE id = $1 RETURNING id, username, email`, [id]);
    if (dbRes.rows.length === 0) return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "User not found." } as ApiErrorResponse);

    const deleted = dbRes.rows[0];
    if (deleted.email) await logEmailSent(deleted.email, "admin@project-inferno.com", "Account Deletion Notification", "success");
    return res.json({ message: `Account for ${deleted.username} permanently deleted.` });
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Admin Get Email Logs
app.get("/api/admin/email-logs", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Admin privileges required." } as ApiErrorResponse);
  }

  try {
    const dbRes = await query(
      `SELECT id, recipient_email as "recipientEmail", sender_email as "senderEmail",
              subject, status, sent_at as "sentAt"
       FROM email_logs ORDER BY sent_at DESC`
    );
    const combinedLogs = [...dbRes.rows, ...memoryEmailLogs].sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    );
    return res.json(combinedLogs);
  } catch {
    return res.json(memoryEmailLogs);
  }
});

// Admin Get World Logs
app.get("/api/admin/world-logs", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Admin privileges required." } as ApiErrorResponse);
  }

  const { worldId } = req.query;
  try {
    let sql = `SELECT id, world_id as "worldId", world_name as "worldName", action,
                     performed_by_username as "performedByUsername", details, created_at as "createdAt"
              FROM world_logs`;
    const params: any[] = [];
    if (worldId) {
      sql += " WHERE world_id = $1";
      params.push(worldId);
    }
    sql += " ORDER BY created_at DESC";

    const dbRes = await query(sql, params);
    const combinedLogs = [...dbRes.rows, ...memoryWorldLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return res.json(combinedLogs);
  } catch {
    return res.json(memoryWorldLogs);
  }
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
    maxPlayers: capacity,
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
      const nRes = await client.query(
        `INSERT INTO player_bases (world_id, user_id, name, q, r, position_x, position_y, tint_race_id, neutral_origin, points)
         VALUES ($1, NULL, 'Abandoned Village', $2, $3, $2, $3, $4, 'GENERATED_INITIAL', 100)
         ON CONFLICT (world_id, q, r) DO NOTHING
         RETURNING id`,
        [createdWorld.id, hex.q, hex.r, NEUTRAL_RACE_ID]
      );
      if (nRes.rows.length > 0) {
        await ensureBaseInitialData(client, nRes.rows[0].id, NEUTRAL_RACE_ID);
      }
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

// Admin Update World Details (Schedule / Limit)
app.patch("/api/admin/worlds/:id", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "Admin privileges required." } as ApiErrorResponse);
  }

  const { id } = req.params;
  const { startsAt, maxPlayers } = req.body;

  try {
    const worldRes = await query("SELECT id, name, status, starts_at as \"startsAt\", max_players as \"maxPlayers\" FROM worlds WHERE id = $1", [id]);
    if (worldRes.rows.length === 0) return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "World not found." } as ApiErrorResponse);

    const world = worldRes.rows[0];
    if (world.status === "archived") {
      return res.status(400).json({ code: ErrorCode.ACTION_NOT_ALLOWED, message: "Cannot modify an archived world." } as ApiErrorResponse);
    }

    const newStartsAt = startsAt ? new Date(startsAt) : world.startsAt;
    const newMaxPlayers = maxPlayers && maxPlayers > 0 ? maxPlayers : world.maxPlayers;

    const updateRes = await query(
      `UPDATE worlds SET starts_at = $1, max_players = $2 WHERE id = $3
       RETURNING id, name, status, starts_at as "startsAt", max_players as "maxPlayers", created_at as "createdAt"`,
      [newStartsAt, newMaxPlayers, id]
    );

    const updatedWorld = updateRes.rows[0];
    await logWorldAction(updatedWorld.id, updatedWorld.name, "DETAILS_UPDATED", authUser.id, authUser.username, {
      startsAt: updatedWorld.startsAt,
      maxPlayers: updatedWorld.maxPlayers,
    });

    return res.json(updatedWorld);
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
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

app.delete("/api/worlds/:id/reserve", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ code: ErrorCode.UNAUTHORIZED, message: "Login required." } as ApiErrorResponse);

  const { id } = req.params;
  try {
    await query("DELETE FROM world_reservations WHERE world_id = $1 AND user_id = $2", [id, authUser.id]);
    return res.json({ message: "Reservation canceled successfully." });
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Join World & Spawn Player Base
app.post("/api/worlds/:worldId/join", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ code: ErrorCode.UNAUTHORIZED, message: "Login required." } as ApiErrorResponse);

  const { worldId } = req.params;
  const { tintRaceId } = req.body;

  if (!tintRaceId || !isValidPlayableRace(tintRaceId)) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "A valid initial playable race must be selected (WEAREBEARS is a neutral race and cannot be chosen).",
    } as ApiErrorResponse);
  }

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

    const existingPlayerBase = await client.query("SELECT id FROM player_bases WHERE world_id = $1 AND user_id = $2 LIMIT 1", [worldId, authUser.id]);
    if (existingPlayerBase.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ code: ErrorCode.ACTION_NOT_ALLOWED, message: "You already have a base in this world." } as ApiErrorResponse);
    }

    const mapConfig: WorldMapConfig = { ...DEFAULT_WORLD_MAP_CONFIG, ...world.map_config };

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

    const spawnSelection = selectPlayerSpawnHex(mapConfig, occupiedHexes, existingPlayerHexes, existingNeutralHexes);
    if (!spawnSelection) {
      await client.query("ROLLBACK");
      return res.status(400).json({ code: ErrorCode.ACTION_NOT_ALLOWED, message: "No available spawn location remaining in this world." } as ApiErrorResponse);
    }

    const playerBaseName = `${authUser.username}'s Village`;
    const playerBaseRes = await client.query(
      `INSERT INTO player_bases (world_id, user_id, name, q, r, position_x, position_y, tint_race_id, points)
       VALUES ($1, $2, $3, $4, $5, $4, $5, $6, 100)
       RETURNING id, world_id as "worldId", user_id as "userId", name, q, r,
                 position_x as "positionX", position_y as "positionY",
                 tint_race_id as "tintRaceId", neutral_origin as "neutralOrigin", points, created_at as "createdAt"`,
      [worldId, authUser.id, playerBaseName, spawnSelection.playerHex.q, spawnSelection.playerHex.r, tintRaceId || null]
    );

    const pBaseRecord = playerBaseRes.rows[0];
    await ensureBaseInitialData(client, pBaseRecord.id, tintRaceId);
    const pBaseStorages = await updateAndSaveVillageResources(client, pBaseRecord.id);
    const pBaseBuildingsMap = await getVillageBuildingsMap(client, pBaseRecord.id);
    const pBaseBuildings = buildBaseBuildingsDtos(pBaseBuildingsMap, tintRaceId);

    const playerBase: BaseDto = {
      ...pBaseRecord,
      positionX: pBaseRecord.positionX ?? spawnSelection.playerHex.q,
      positionY: pBaseRecord.positionY ?? spawnSelection.playerHex.r,
      ownerUsername: authUser.username,
      buildings: pBaseBuildings,
      resourceStorages: pBaseStorages,
      resources: {
        amountAtReference: pBaseStorages["BUILDING_MATERIAL"].amount,
        productionRate: pBaseStorages["BUILDING_MATERIAL"].productionRate,
        referenceAt: pBaseStorages["BUILDING_MATERIAL"].referenceAt,
        capacity: pBaseStorages["BUILDING_MATERIAL"].capacity,
      },
    };

    const guaranteedNeutrals: BaseDto[] = [];
    for (let i = 0; i < spawnSelection.guaranteedNeutrals.length; i++) {
      const nHex = spawnSelection.guaranteedNeutrals[i];
      const neutralRes = await client.query(
        `INSERT INTO player_bases (world_id, user_id, name, q, r, position_x, position_y, tint_race_id, neutral_origin, points)
         VALUES ($1, NULL, 'Abandoned Village', $2, $3, $2, $3, $4, 'GENERATED_START_GUARANTEE', 100)
         ON CONFLICT (world_id, q, r) DO NOTHING
         RETURNING id, world_id as "worldId", user_id as "userId", name, q, r,
                   position_x as "positionX", position_y as "positionY",
                   tint_race_id as "tintRaceId", neutral_origin as "neutralOrigin", points, created_at as "createdAt"`,
        [worldId, nHex.q, nHex.r, NEUTRAL_RACE_ID]
      );

      if (neutralRes.rows.length > 0) {
        const nRecord = neutralRes.rows[0];
        await ensureBaseInitialData(client, nRecord.id, NEUTRAL_RACE_ID);
        const nStorages = await updateAndSaveVillageResources(client, nRecord.id);
        const nBuildingsMap = await getVillageBuildingsMap(client, nRecord.id);
        const nBuildings = buildBaseBuildingsDtos(nBuildingsMap, NEUTRAL_RACE_ID);

        guaranteedNeutrals.push({
          ...nRecord,
          positionX: nRecord.positionX ?? nHex.q,
          positionY: nRecord.positionY ?? nHex.r,
          ownerUsername: null,
          buildings: nBuildings,
          resourceStorages: nStorages,
          resources: {
            amountAtReference: nStorages["BUILDING_MATERIAL"].amount,
            productionRate: nStorages["BUILDING_MATERIAL"].productionRate,
            referenceAt: nStorages["BUILDING_MATERIAL"].referenceAt,
            capacity: nStorages["BUILDING_MATERIAL"].capacity,
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

// Map Chunk Endpoint
app.get("/api/worlds/:worldId/map/chunks", async (req: Request, res: Response) => {
  const { worldId } = req.params;
  const qMin = parseInt(req.query.qMin as string, 10) || -15;
  const qMax = parseInt(req.query.qMax as string, 10) || 15;
  const rMin = parseInt(req.query.rMin as string, 10) || -15;
  const rMax = parseInt(req.query.rMax as string, 10) || 15;

  try {
    const worldRes = await query("SELECT map_config FROM worlds WHERE id = $1", [worldId]);
    const mapConfig: WorldMapConfig = { ...DEFAULT_WORLD_MAP_CONFIG, ...worldRes.rows[0]?.map_config };

    const dbRes = await query(
      `SELECT b.id, b.world_id as "worldId", b.user_id as "userId", u.username as "ownerUsername",
              b.name, b.q, b.r, b.position_x as "positionX", b.position_y as "positionY",
              b.tint_race_id as "tintRaceId", b.neutral_origin as "neutralOrigin",
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
      positionX: row.positionX ?? row.q,
      positionY: row.positionY ?? row.r,
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

    // Generate cosmetic terrain features for non-settlement hexes in chunk
    const occupiedKeys = new Set(settlements.map((s) => `${s.q},${s.r}`));
    const allTerrainFeatures = generateCosmeticTerrainFeatures(mapConfig, occupiedKeys);
    const chunkTerrain = allTerrainFeatures.filter(
      (f) => f.q >= qMin && f.q <= qMax && f.r >= rMin && f.r <= rMax
    );

    const chunkDto: MapChunkDto = {
      chunkKey: `${qMin}_${qMax}_${rMin}_${rMax}`,
      qMin,
      qMax,
      rMin,
      rMax,
      settlements,
      terrainFeatures: chunkTerrain,
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
      `SELECT b.id, b.q, b.r, b.position_x as "positionX", b.position_y as "positionY",
              b.user_id as "userId", u.username as "ownerUsername",
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
      positionX: row.positionX ?? row.q,
      positionY: row.positionY ?? row.r,
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

// Schedule Event Route
app.post("/api/events", async (req: Request, res: Response) => {
  const { worldId, eventType, executeAt, payload } = req.body;
  if (!worldId || !eventType || !executeAt) {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: "worldId, eventType, and executeAt are required" } as ApiErrorResponse);
  }

  try {
    const dbRes = await query(
      `INSERT INTO game_events (world_id, event_type, execute_at, payload, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING id, world_id as "worldId", event_type as "eventType", status, execute_at as "executeAt", payload, created_at as "createdAt"`,
      [worldId, eventType, executeAt, JSON.stringify(payload || {})]
    );

    return res.json(dbRes.rows[0]);
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

// Base Village Buildings & Resources Endpoints
app.get("/api/bases/:baseId/buildings", async (req: Request, res: Response) => {
  const { baseId } = req.params;
  try {
    const baseRes = await query("SELECT id, tint_race_id as \"tintRaceId\" FROM player_bases WHERE id = $1", [baseId]);
    if (baseRes.rows.length === 0) {
      return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "Base not found." } as ApiErrorResponse);
    }
    const tintRaceId = baseRes.rows[0].tintRaceId;
    await updateAndSaveVillageResources(query, baseId);
    const buildingsMap = await getVillageBuildingsMap(query, baseId);
    const dtos = buildBaseBuildingsDtos(buildingsMap, tintRaceId);
    return res.json(dtos);
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

app.get("/api/bases/:baseId/resources", async (req: Request, res: Response) => {
  const { baseId } = req.params;
  try {
    const baseRes = await query("SELECT id FROM player_bases WHERE id = $1", [baseId]);
    if (baseRes.rows.length === 0) {
      return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "Base not found." } as ApiErrorResponse);
    }
    const storages = await updateAndSaveVillageResources(query, baseId);
    return res.json(storages);
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

app.post("/api/bases/:baseId/buildings/:buildingType/upgrade", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ code: ErrorCode.UNAUTHORIZED, message: "Login required." } as ApiErrorResponse);
  }

  const { baseId, buildingType } = req.params;
  const targetBType = buildingType as BuildingTypeId;

  if (!CANONICAL_BUILDING_IDS.includes(targetBType)) {
    return res.status(400).json({ code: ErrorCode.INVALID_INPUT, message: `Invalid building type '${buildingType}'.` } as ApiErrorResponse);
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const baseRes = await client.query(
      `SELECT id, user_id as "userId", tint_race_id as "tintRaceId" FROM player_bases WHERE id = $1 FOR UPDATE`,
      [baseId]
    );

    if (baseRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "Base not found." } as ApiErrorResponse);
    }

    const baseRecord = baseRes.rows[0];
    if (baseRecord.userId && baseRecord.userId !== authUser.id && authUser.role !== "admin" && authUser.role !== "super_admin") {
      await client.query("ROLLBACK");
      return res.status(403).json({ code: ErrorCode.FORBIDDEN, message: "You do not own this base." } as ApiErrorResponse);
    }

    const tintRaceId = baseRecord.tintRaceId;
    const now = new Date();

    // 1. Calculate & update resources up to now
    const currentStorages = await updateAndSaveVillageResources(client, baseId, now);

    // 2. Fetch buildings map
    const buildingsMap = await getVillageBuildingsMap(client, baseId);
    const currentLevel = buildingsMap[targetBType] || 0;
    const def = BUILDING_DEFINITIONS[targetBType];

    if (currentLevel >= def.maxLevel) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        code: ErrorCode.ACTION_NOT_ALLOWED,
        message: `Building '${def.canonicalName}' has already reached maximum level (${def.maxLevel}).`,
      } as ApiErrorResponse);
    }

    // 3. Check prerequisites
    const { isMet, missingPrerequisites } = checkBuildingPrerequisites(targetBType, buildingsMap);
    if (!isMet) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        code: ErrorCode.ACTION_NOT_ALLOWED,
        message: `Prerequisites not met for upgrading '${def.canonicalName}'.`,
        details: { missingPrerequisites },
      } as ApiErrorResponse);
    }

    // 4. Check upgrade cost
    const targetLevel = currentLevel + 1;
    const upgradeCost = calculateBuildingUpgradeCost(targetBType, targetLevel, tintRaceId);

    for (const rTypeStr of Object.keys(upgradeCost)) {
      const rType = rTypeStr as ResourceType;
      const requiredAmount = upgradeCost[rType] || 0;
      const availableAmount = currentStorages[rType]?.amount || 0;
      if (availableAmount < requiredAmount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          code: ErrorCode.INSUFFICIENT_QUANTITY,
          message: `Insufficient ${rType} (Required: ${requiredAmount}, Available: ${Math.floor(availableAmount)}).`,
        } as ApiErrorResponse);
      }
    }

    // 5. Deduct cost & update level in base_buildings
    for (const rTypeStr of Object.keys(upgradeCost)) {
      const rType = rTypeStr as ResourceType;
      const requiredAmount = upgradeCost[rType] || 0;
      currentStorages[rType].amount = Math.max(0, currentStorages[rType].amount - requiredAmount);
      await client.query(
        `UPDATE base_resources SET amount = $1, ref_at = $2 WHERE base_id = $3 AND resource_type = $4`,
        [currentStorages[rType].amount, now.toISOString(), baseId, rType]
      );
    }

    const newLevel = currentLevel + 1;
    await client.query(
      `INSERT INTO base_buildings (base_id, building_type, level, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (base_id, building_type) DO UPDATE SET level = EXCLUDED.level, updated_at = NOW()`,
      [baseId, targetBType, newLevel]
    );

    // 6. Recalculate production rates, capacities & save
    const updatedStorages = await updateAndSaveVillageResources(client, baseId, now);
    const updatedBuildingsMap = await getVillageBuildingsMap(client, baseId);
    const updatedBuildingsDtos = buildBaseBuildingsDtos(updatedBuildingsMap, tintRaceId);
    const updatedBuildingDto = updatedBuildingsDtos.find((b) => b.buildingType === targetBType)!;

    await client.query("COMMIT");

    return res.json({
      message: `Successfully upgraded ${updatedBuildingDto.displayName} to Level ${newLevel}!`,
      building: updatedBuildingDto,
      buildings: updatedBuildingsDtos,
      resources: updatedStorages,
    } as UpgradeBuildingResponse);
  } catch (err: any) {
    await client.query("ROLLBACK");
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  } finally {
    client.release();
  }
});

// Player Bases Legacy Endpoint
app.get("/api/worlds/:worldId/bases", async (req: Request, res: Response) => {
  const { worldId } = req.params;
  try {
    const dbRes = await query(
      `SELECT b.id, b.world_id as "worldId", b.user_id as "userId", u.username as "ownerUsername",
              b.name, b.q, b.r, b.position_x as "positionX", b.position_y as "positionY",
              b.tint_race_id as "tintRaceId", b.neutral_origin as "neutralOrigin",
              b.points, b.resource_amount_at_ref as "resourceAmountAtRef",
              b.resource_production_rate as "resourceProductionRate",
              b.resource_ref_at as "resourceRefAt", b.resource_capacity as "resourceCapacity",
              b.created_at as "createdAt"
       FROM player_bases b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.world_id = $1`,
      [worldId]
    );

    const now = new Date();
    const bases: BaseDto[] = dbRes.rows.map((row) => {
      const currentAmount = calculateResources({
        amountAtReference: Number(row.resourceAmountAtRef || 100),
        productionRate: Number(row.resourceProductionRate || 1),
        referenceAt: row.resourceRefAt ? new Date(row.resourceRefAt) : now,
        effectiveTime: now,
        capacity: Number(row.resourceCapacity || 10000),
      });

      return {
        id: row.id,
        worldId: row.worldId,
        userId: row.userId,
        ownerUsername: row.ownerUsername,
        name: row.name,
        q: row.q,
        r: row.r,
        positionX: row.positionX ?? row.q,
        positionY: row.positionY ?? row.r,
        tintRaceId: row.tintRaceId,
        neutralOrigin: row.neutralOrigin,
        points: row.points,
        resources: {
          amountAtReference: Math.round(currentAmount * 100) / 100,
          productionRate: Number(row.resourceProductionRate || 1),
          referenceAt: now.toISOString(),
          capacity: Number(row.resourceCapacity || 10000),
        },
        createdAt: row.createdAt,
      };
    });

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
