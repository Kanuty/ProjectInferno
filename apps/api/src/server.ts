import express, { Request, Response, NextFunction, Express } from "express";
import cors from "cors";
import crypto from "crypto";
import { ErrorCode, ApiErrorResponse, HealthCheckResponse, UserDto, WorldDto, PlayerBaseDto, CheckUsernameResponse, AuthResponse } from "@project-inferno/contracts";
import { query, runMigrations, getClient, purgeUnactivatedAccounts } from "@project-inferno/database";

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

// Auth Check Username Endpoint (Real-time onBlur check)
app.get("/api/auth/check-username", async (req: Request, res: Response) => {
  const username = req.query.username as string;
  if (!username || username.trim().length < 3) {
    return res.status(400).json({
      available: false,
      message: "Username must be at least 3 characters long.",
    } as CheckUsernameResponse);
  }

  try {
    const dbRes = await query(
      "SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1",
      [username.trim()]
    );

    if (dbRes.rows.length > 0) {
      return res.json({
        available: false,
        message: "Username is already taken.",
      } as CheckUsernameResponse);
    }

    return res.json({
      available: true,
      message: "Username is available.",
    } as CheckUsernameResponse);
  } catch (err: any) {
    return res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: err.message,
    } as ApiErrorResponse);
  }
});

// Auth Register Route
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

  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 3) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "Username must be at least 3 characters long.",
    } as ApiErrorResponse);
  }

  if (passwordHash.length < 8) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "Password must be at least 8 characters long.",
    } as ApiErrorResponse);
  }

  if (termsAccepted === false) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "You must accept the Terms of Service and Privacy Policy to register.",
    } as ApiErrorResponse);
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Concurrency safety check: Acquire explicit lock on potential matching users
    const existingCheck = await client.query(
      `SELECT username, email FROM users
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)
       FOR UPDATE`,
      [trimmedUsername, email.trim()]
    );

    if (existingCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      const existing = existingCheck.rows[0];
      const field = existing.username.toLowerCase() === trimmedUsername.toLowerCase() ? "username" : "email address";
      return res.status(400).json({
        code: ErrorCode.INVALID_INPUT,
        message: `An account with this ${field} already exists.`,
      } as ApiErrorResponse);
    }

    const termsAcceptedAt = termsAccepted ? new Date() : null;
    const activationToken = crypto.randomBytes(32).toString("hex");

    const dbRes = await client.query<UserDto>(
      `INSERT INTO users (username, email, password_hash, terms_accepted_at, status, activation_token)
       VALUES ($1, $2, $3, $4, 'pending_activation', $5)
       RETURNING id, username, email, status, created_at as "createdAt"`,
      [trimmedUsername, email.trim().toLowerCase(), passwordHash, termsAcceptedAt, activationToken]
    );

    await client.query("COMMIT");

    const user = dbRes.rows[0];
    const confirmationLink = `http://localhost:5173/?activationToken=${activationToken}`;

    console.log("=================================================");
    console.log(`[MOCK EMAIL SERVICE] Confirmation email sent to ${user.email}`);
    console.log(`Hello ${user.username}, please activate your Project Inferno account:`);
    console.log(`Confirmation Link: ${confirmationLink}`);
    console.log("=================================================");

    return res.json({
      token: "", // Unactivated account does not issue auth token until confirmed
      user,
      message: "Account created! A confirmation email has been sent. Please check your inbox and click the confirmation link to activate your account.",
    } as AuthResponse);
  } catch (err: any) {
    await client.query("ROLLBACK");
    let message = err.message || "User registration failed.";
    if (err.code === "23505") { // Unique violation in Postgres
      message = "An account with this username or email address already exists.";
    }
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message,
    } as ApiErrorResponse);
  } finally {
    client.release();
  }
});

// Auth Activate Account Route
app.post("/api/auth/activate", async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "Activation token is required.",
    } as ApiErrorResponse);
  }

  try {
    const dbRes = await query<UserDto>(
      `UPDATE users
       SET status = 'active', activation_token = NULL, updated_at = NOW()
       WHERE activation_token = $1 AND status = 'pending_activation'
       RETURNING id, username, email, status, created_at as "createdAt"`,
      [token]
    );

    if (dbRes.rows.length === 0) {
      return res.status(400).json({
        code: ErrorCode.INVALID_INPUT,
        message: "Invalid or expired activation link.",
      } as ApiErrorResponse);
    }

    const user = dbRes.rows[0];
    return res.json({
      token: `mock-jwt-token-${user.id}`,
      user,
      message: "Account successfully activated! Welcome to Project Inferno.",
    } as AuthResponse);
  } catch (err: any) {
    return res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: err.message,
    } as ApiErrorResponse);
  }
});

// Auth Login Route (Supports username OR email address)
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { login, passwordHash } = req.body;
  if (!login || !passwordHash) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "Username/Email and password are required.",
    } as ApiErrorResponse);
  }

  if (passwordHash.length < 8) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "Password must be at least 8 characters long.",
    } as ApiErrorResponse);
  }

  try {
    const dbRes = await query<UserDto & { password_hash: string; status: string; role: "admin" | "user" }>(
      `SELECT id, username, email, status, role, created_at as "createdAt", password_hash
       FROM users
       WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)`,
      [login.trim()]
    );

    if (dbRes.rows.length === 0 || dbRes.rows[0].password_hash !== passwordHash) {
      return res.status(401).json({
        code: ErrorCode.UNAUTHORIZED,
        message: "Invalid credentials.",
      } as ApiErrorResponse);
    }

    const userRecord = dbRes.rows[0];
    if (userRecord.status === "pending_activation") {
      return res.status(403).json({
        code: ErrorCode.FORBIDDEN,
        message: "Account is not activated yet. Please click the confirmation link sent to your email.",
      } as ApiErrorResponse);
    }

    if (userRecord.status !== "active") {
      return res.status(403).json({
        code: ErrorCode.FORBIDDEN,
        message: "Account is suspended or inactive.",
      } as ApiErrorResponse);
    }

    const { password_hash, ...user } = userRecord;
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

// Helper middleware to get authenticated user
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

// User Profile Route
app.get("/api/users/me", async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({
      code: ErrorCode.UNAUTHORIZED,
      message: "Missing or invalid authorization header.",
    } as ApiErrorResponse);
  }
  return res.json(user);
});

// Auth Password Reset - Forgot Password
app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "Email address is required.",
    } as ApiErrorResponse);
  }

  try {
    const dbRes = await query(
      "SELECT id, username, email FROM users WHERE LOWER(email) = LOWER($1)",
      [email.trim()]
    );

    if (dbRes.rows.length > 0) {
      const user = dbRes.rows[0];
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour expiration

      await query(
        `UPDATE users
         SET reset_token = $1, reset_token_expires_at = $2, updated_at = NOW()
         WHERE id = $3`,
        [resetToken, expiresAt, user.id]
      );

      const resetLink = `http://localhost:5173/?resetToken=${resetToken}`;
      console.log("=================================================");
      console.log(`[MOCK EMAIL SERVICE] Password Reset email sent to ${user.email}`);
      console.log(`Hello ${user.username}, you requested a password reset for your Project Inferno account:`);
      console.log(`Reset Link: ${resetLink}`);
      console.log("=================================================");
    }

    // Always return success message to prevent user enumeration
    return res.json({
      message: "If an account with that email exists, a password reset link has been sent to it.",
    });
  } catch (err: any) {
    return res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: err.message,
    } as ApiErrorResponse);
  }
});

// Auth Password Reset - Confirm Reset Password
app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
  const { token, newPasswordHash } = req.body;
  if (!token || !newPasswordHash) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "Reset token and new password are required.",
    } as ApiErrorResponse);
  }

  if (newPasswordHash.length < 8) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "Password must be at least 8 characters long.",
    } as ApiErrorResponse);
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
      return res.status(400).json({
        code: ErrorCode.INVALID_INPUT,
        message: "Invalid or expired password reset token.",
      } as ApiErrorResponse);
    }

    return res.json({
      message: "Password reset successful! You may now log in with your new password.",
    });
  } catch (err: any) {
    return res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: err.message,
    } as ApiErrorResponse);
  }
});

// Admin - Get All Users
app.get("/api/admin/users", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({
      code: ErrorCode.FORBIDDEN,
      message: "Access denied. Admin privileges required.",
    } as ApiErrorResponse);
  }

  try {
    const dbRes = await query<UserDto>(
      `SELECT id, username, email, status, role, created_at as "createdAt"
       FROM users
       ORDER BY created_at DESC`
    );
    return res.json(dbRes.rows);
  } catch (err: any) {
    return res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: err.message,
    } as ApiErrorResponse);
  }
});

// Admin - Block/Unblock User
app.post("/api/admin/users/:id/block", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({
      code: ErrorCode.FORBIDDEN,
      message: "Access denied. Admin privileges required.",
    } as ApiErrorResponse);
  }

  const { id } = req.params;
  const { status } = req.body;

  if (status !== "active" && status !== "suspended") {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "Status must be 'active' or 'suspended'.",
    } as ApiErrorResponse);
  }

  if (id === authUser.id) {
    return res.status(400).json({
      code: ErrorCode.ACTION_NOT_ALLOWED,
      message: "You cannot change your own admin account status.",
    } as ApiErrorResponse);
  }

  try {
    const dbRes = await query<UserDto>(
      `UPDATE users
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, email, status, role, created_at as "createdAt"`,
      [status, id]
    );

    if (dbRes.rows.length === 0) {
      return res.status(404).json({
        code: ErrorCode.NOT_FOUND,
        message: "User not found.",
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

// Admin - Delete User (Sends email notification)
app.delete("/api/admin/users/:id", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({
      code: ErrorCode.FORBIDDEN,
      message: "Access denied. Admin privileges required.",
    } as ApiErrorResponse);
  }

  const { id } = req.params;

  if (id === authUser.id) {
    return res.status(400).json({
      code: ErrorCode.ACTION_NOT_ALLOWED,
      message: "You cannot delete your own admin account.",
    } as ApiErrorResponse);
  }

  try {
    const dbRes = await query<UserDto>(
      `DELETE FROM users
       WHERE id = $1
       RETURNING id, username, email, status, role, created_at as "createdAt"`,
      [id]
    );

    if (dbRes.rows.length === 0) {
      return res.status(404).json({
        code: ErrorCode.NOT_FOUND,
        message: "User not found.",
      } as ApiErrorResponse);
    }

    const deletedUser = dbRes.rows[0];

    console.log("=================================================");
    console.log(`[MOCK EMAIL SERVICE] Account Deletion email sent to ${deletedUser.email}`);
    console.log(`Hello ${deletedUser.username}, your Project Inferno account has been deleted by an administrator.`);
    console.log("=================================================");

    return res.json({
      message: `Account for ${deletedUser.username} (${deletedUser.email}) has been permanently deleted and a notification email was sent.`,
    });
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
