import express, { Request, Response, NextFunction, Express } from "express";
import cors from "cors";
import { ErrorCode, ApiErrorResponse, HealthCheckResponse, UserDto, WorldDto, PlayerBaseDto } from "@project-inferno/contracts";
import { query, runMigrations } from "@project-inferno/database";

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health Check Endpoint
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

// Auth Routes (Mock/Baseline implementations)
app.post("/api/auth/register", async (req: Request, res: Response) => {
  const { username, email, passwordHash, termsAccepted } = req.body;

  if (!username || !email || !passwordHash) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "Username, email, and passwordHash are required.",
    } as ApiErrorResponse);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "Please provide a valid email address.",
    } as ApiErrorResponse);
  }

  if (username.trim().length < 3) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "Username must be at least 3 characters long.",
    } as ApiErrorResponse);
  }

  if (passwordHash.length < 6) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "Password must be at least 6 characters long.",
    } as ApiErrorResponse);
  }

  if (termsAccepted === false) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "You must accept the Terms of Service and Privacy Policy to register.",
    } as ApiErrorResponse);
  }

  try {
    const termsAcceptedAt = termsAccepted ? new Date() : null;
    const dbRes = await query<UserDto>(
      `INSERT INTO users (username, email, password_hash, terms_accepted_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, created_at as "createdAt"`,
      [username.trim(), email.trim().toLowerCase(), passwordHash, termsAcceptedAt]
    );
    const user = dbRes.rows[0];
    return res.json({
      token: `mock-jwt-token-${user.id}`,
      user,
    });
  } catch (err: any) {
    let message = err.message || "User registration failed.";
    if (err.code === "23505") { // Unique violation in Postgres
      if (err.constraint?.includes("username")) {
        message = "A player with this username already exists.";
      } else if (err.constraint?.includes("email")) {
        message = "An account with this email address already exists.";
      }
    }
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message,
    } as ApiErrorResponse);
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, passwordHash } = req.body;
  try {
    const dbRes = await query<UserDto & { password_hash: string }>(
      "SELECT id, username, email, created_at as \"createdAt\", password_hash FROM users WHERE email = $1",
      [email]
    );

    if (dbRes.rows.length === 0 || dbRes.rows[0].password_hash !== passwordHash) {
      return res.status(401).json({
        code: ErrorCode.UNAUTHORIZED,
        message: "Invalid credentials.",
      } as ApiErrorResponse);
    }

    const { password_hash, ...user } = dbRes.rows[0];
    return res.json({
      token: `mock-jwt-token-${user.id}`,
      user,
    });
  } catch (err: any) {
    return res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: "Login failed due to database error.",
    } as ApiErrorResponse);
  }
});

// User Profile Route
app.get("/api/users/me", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      code: ErrorCode.UNAUTHORIZED,
      message: "Missing Authorization header",
    } as ApiErrorResponse);
  }

  const token = authHeader.replace("Bearer ", "");
  const userId = token.replace("mock-jwt-token-", "");

  try {
    const dbRes = await query<UserDto>(
      "SELECT id, username, email, created_at as \"createdAt\" FROM users WHERE id = $1",
      [userId]
    );
    if (dbRes.rows.length === 0) {
      return res.status(404).json({
        code: ErrorCode.NOT_FOUND,
        message: "User not found",
      } as ApiErrorResponse);
    }

    return res.json(dbRes.rows[0]);
  } catch (err: any) {
    return res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: err.message,
    } as ApiErrorResponse);
  }
});

// Worlds Route
app.get("/api/worlds", async (_req: Request, res: Response) => {
  try {
    const dbRes = await query<WorldDto>(
      "SELECT id, name, status, created_at as \"createdAt\" FROM worlds"
    );
    return res.json(dbRes.rows);
  } catch (err: any) {
    return res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: err.message,
    } as ApiErrorResponse);
  }
});

// Player Bases Route
app.get("/api/worlds/:worldId/bases", async (req: Request, res: Response) => {
  const { worldId } = req.params;
  try {
    const dbRes = await query(
      `SELECT id, world_id as "worldId", user_id as "userId", name,
              position_x as "positionX", position_y as "positionY",
              resource_amount_at_ref as "resourceAmountAtRef",
              resource_production_rate as "resourceProductionRate",
              resource_ref_at as "resourceRefAt",
              resource_capacity as "resourceCapacity",
              created_at as "createdAt"
       FROM player_bases WHERE world_id = $1`,
      [worldId]
    );

    const bases: PlayerBaseDto[] = dbRes.rows.map((row) => ({
      id: row.id,
      worldId: row.worldId,
      userId: row.userId,
      name: row.name,
      positionX: row.positionX,
      positionY: row.positionY,
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
    return res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: err.message,
    } as ApiErrorResponse);
  }
});

// Schedule Event Route
app.post("/api/events", async (req: Request, res: Response) => {
  const { worldId, eventType, executeAt, payload } = req.body;
  if (!worldId || !eventType || !executeAt) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "worldId, eventType, and executeAt are required",
    } as ApiErrorResponse);
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
    return res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: err.message,
    } as ApiErrorResponse);
  }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    code: ErrorCode.INTERNAL_ERROR,
    message: "Internal server error",
  } as ApiErrorResponse);
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, async () => {
    console.log(`API Server listening on port ${PORT}`);
    if (process.env.AUTO_MIGRATE !== "false") {
      try {
        await runMigrations();
      } catch (err: any) {
        console.warn("[API] Startup database migration skipped or failed (Database may be offline/unreachable):", err.message || err);
      }
    }
  });
}

export { app };
