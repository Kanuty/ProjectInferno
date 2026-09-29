import express, { Request, Response, NextFunction, Express } from "express";
import cors from "cors";
import crypto from "crypto";
import { ErrorCode, ApiErrorResponse, HealthCheckResponse, UserDto, WorldDto, PlayerBaseDto, CheckUsernameResponse, AuthResponse, EmailLogDto, WorldStageStatus, WorldLogDto } from "@project-inferno/contracts";
import { query, runMigrations, getClient, purgeUnactivatedAccounts } from "@project-inferno/database";

// In-memory fallback email log store if DB table isn't ready
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
  } catch (err) {
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
  } catch (err) {
    // Graceful fallback to memory store if DB write fails
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
    const senderEmail = "noreply@project-inferno.com";
    const subject = "Activate your Project Inferno account";

    if (user.email) {
      await logEmailSent(user.email, senderEmail, subject, "success");
    }

    console.log("=================================================");
    console.log(`[MOCK EMAIL SERVICE] ${subject} sent to ${user.email}`);
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

  try {
    const dbRes = await query<UserDto & { password_hash: string; status: string; role: "super_admin" | "admin" | "user" }>(
      `SELECT id, username, email, status, role, created_at as "createdAt", password_hash
       FROM users
       WHERE (email IS NOT NULL AND LOWER(email) = LOWER($1)) OR LOWER(username) = LOWER($1)`,
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
      const senderEmail = "security@project-inferno.com";
      const subject = "Password Reset Request";

      await logEmailSent(user.email, senderEmail, subject, "success");

      console.log("=================================================");
      console.log(`[MOCK EMAIL SERVICE] ${subject} sent to ${user.email}`);
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
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
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

// Admin - Get Email Logs
app.get("/api/admin/email-logs", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({
      code: ErrorCode.FORBIDDEN,
      message: "Access denied. Admin privileges required.",
    } as ApiErrorResponse);
  }

  try {
    const dbRes = await query(
      `SELECT id, recipient_email as "recipientEmail", sender_email as "senderEmail",
              subject, status, sent_at as "sentAt"
       FROM email_logs
       ORDER BY sent_at DESC`
    );
    const combinedLogs = [...dbRes.rows, ...memoryEmailLogs].sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    );
    return res.json(combinedLogs);
  } catch {
    return res.json(memoryEmailLogs);
  }
});

// Admin - Manual Create User
app.post("/api/admin/users", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({
      code: ErrorCode.FORBIDDEN,
      message: "Access denied. Admin privileges required.",
    } as ApiErrorResponse);
  }

  const { username, passwordHash, email, role } = req.body;
  if (!username || !passwordHash) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "Username and passwordHash are required.",
    } as ApiErrorResponse);
  }

  // Only super_admin can create super_admin users
  if (role === "super_admin" && authUser.role !== "super_admin") {
    return res.status(403).json({
      code: ErrorCode.FORBIDDEN,
      message: "Only a Super Admin can create other Super Admin accounts.",
    } as ApiErrorResponse);
  }

  const targetRole = role === "super_admin" ? "super_admin" : role === "admin" ? "admin" : role === "tester" ? "tester" : "user";
  const userEmail = email && email.trim() ? email.trim().toLowerCase() : null;

  try {
    const dbRes = await query<UserDto>(
      `INSERT INTO users (username, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, username, email, status, role, created_at as "createdAt"`,
      [username.trim(), userEmail, passwordHash, targetRole]
    );

    return res.json(dbRes.rows[0]);
  } catch (err: any) {
    let message = err.message || "Failed to create user.";
    if (err.code === "23505") {
      message = "An account with this username or email already exists.";
    }
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message,
    } as ApiErrorResponse);
  }
});

// Admin - Block/Unblock User
app.post("/api/admin/users/:id/block", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
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

  // Check target user protection
  const targetUserCheck = await query<UserDto>("SELECT id, username, role FROM users WHERE id = $1", [id]);
  if (targetUserCheck.rows.length > 0) {
    const target = targetUserCheck.rows[0];
    if (target.role === "super_admin" || target.username.toLowerCase() === "inferno") {
      return res.status(400).json({
        code: ErrorCode.ACTION_NOT_ALLOWED,
        message: "Superuser (Inferno) account is protected and cannot be blocked.",
      } as ApiErrorResponse);
    }
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
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
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

  // Check target user protection
  const targetUserCheck = await query<UserDto>("SELECT id, username, role FROM users WHERE id = $1", [id]);
  if (targetUserCheck.rows.length > 0) {
    const target = targetUserCheck.rows[0];
    if (target.role === "super_admin" || target.username.toLowerCase() === "inferno") {
      return res.status(400).json({
        code: ErrorCode.ACTION_NOT_ALLOWED,
        message: "Superuser (Inferno) account is protected and cannot be deleted.",
      } as ApiErrorResponse);
    }
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
    const senderEmail = "admin@project-inferno.com";
    const subject = "Account Deletion Notification";

    if (deletedUser.email) {
      await logEmailSent(deletedUser.email, senderEmail, subject, "success");
    }

    console.log("=================================================");
    console.log(`[MOCK EMAIL SERVICE] ${subject} sent to ${deletedUser.email}`);
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

// Admin - Schedule/Create New World
app.post("/api/admin/worlds", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({
      code: ErrorCode.FORBIDDEN,
      message: "Access denied. Admin privileges required.",
    } as ApiErrorResponse);
  }

  const { name, startsAt, maxPlayers, status, isTestOnly, autoCloseDays } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: "World name is required.",
    } as ApiErrorResponse);
  }

  const initialStatus: WorldStageStatus = status || "planned_open";
  const capacity = maxPlayers && maxPlayers > 0 ? maxPlayers : 100;
  const startDate = startsAt ? new Date(startsAt) : new Date();
  const testOnly = Boolean(isTestOnly);
  const closeDays = autoCloseDays && autoCloseDays > 0 ? autoCloseDays : 20;

  try {
    const dbRes = await query(
      `INSERT INTO worlds (name, status, starts_at, max_players, is_test_only, auto_close_days)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, status, starts_at as "startsAt", max_players as "maxPlayers", is_test_only as "isTestOnly", auto_close_days as "autoCloseDays", created_at as "createdAt"`,
      [name.trim(), initialStatus, startDate, capacity, testOnly, closeDays]
    );

    const createdWorld = dbRes.rows[0];
    await logWorldAction(createdWorld.id, createdWorld.name, "CREATED", authUser.id, authUser.username, {
      status: createdWorld.status,
      maxPlayers: createdWorld.maxPlayers,
      startsAt: createdWorld.startsAt,
      isTestOnly: createdWorld.isTestOnly,
    });

    return res.json(createdWorld);
  } catch (err: any) {
    return res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: err.message,
    } as ApiErrorResponse);
  }
});

// Admin - Update World Stage Status
app.patch("/api/admin/worlds/:id/status", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({
      code: ErrorCode.FORBIDDEN,
      message: "Access denied. Admin privileges required.",
    } as ApiErrorResponse);
  }

  const { id } = req.params;
  const { status } = req.body;

  const validStatuses: WorldStageStatus[] = ["planned_open", "planned_closed", "active", "active_closed", "suspended", "archived"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      code: ErrorCode.INVALID_INPUT,
      message: `Invalid world stage status. Must be one of: ${validStatuses.join(", ")}`,
    } as ApiErrorResponse);
  }

  try {
    const currentWorld = await query("SELECT id, name, status FROM worlds WHERE id = $1", [id]);
    if (currentWorld.rows.length === 0) {
      return res.status(404).json({
        code: ErrorCode.NOT_FOUND,
        message: "World not found.",
      } as ApiErrorResponse);
    }

    const prevWorld = currentWorld.rows[0];
    const dbRes = await query(
      `UPDATE worlds
       SET status = $1
       WHERE id = $2
       RETURNING id, name, status, starts_at as "startsAt", max_players as "maxPlayers", created_at as "createdAt"`,
      [status, id]
    );

    const updatedWorld = dbRes.rows[0];
    await logWorldAction(updatedWorld.id, updatedWorld.name, "STATUS_CHANGED", authUser.id, authUser.username, {
      previousStatus: prevWorld.status,
      newStatus: updatedWorld.status,
    });

    return res.json(updatedWorld);
  } catch (err: any) {
    return res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: err.message,
    } as ApiErrorResponse);
  }
});

// Admin - Update World Schedule / Capacity (For non-archived worlds)
app.patch("/api/admin/worlds/:id", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({
      code: ErrorCode.FORBIDDEN,
      message: "Access denied. Admin privileges required.",
    } as ApiErrorResponse);
  }

  const { id } = req.params;
  const { startsAt, maxPlayers } = req.body;

  try {
    const worldRes = await query("SELECT id, name, status, starts_at as \"startsAt\", max_players as \"maxPlayers\" FROM worlds WHERE id = $1", [id]);
    if (worldRes.rows.length === 0) {
      return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "World not found." } as ApiErrorResponse);
    }

    const world = worldRes.rows[0];
    if (world.status === "archived") {
      return res.status(400).json({
        code: ErrorCode.ACTION_NOT_ALLOWED,
        message: "Cannot modify player limit or schedule for an archived world.",
      } as ApiErrorResponse);
    }

    const newStartsAt = startsAt ? new Date(startsAt) : world.startsAt;
    const newMaxPlayers = maxPlayers && maxPlayers > 0 ? maxPlayers : world.maxPlayers;

    const updateRes = await query(
      `UPDATE worlds
       SET starts_at = $1, max_players = $2
       WHERE id = $3
       RETURNING id, name, status, starts_at as "startsAt", max_players as "maxPlayers", created_at as "createdAt"`,
      [newStartsAt, newMaxPlayers, id]
    );

    const updatedWorld = updateRes.rows[0];

    if (maxPlayers && maxPlayers !== world.maxPlayers) {
      await logWorldAction(updatedWorld.id, updatedWorld.name, "LIMIT_UPDATED", authUser.id, authUser.username, {
        previousMaxPlayers: world.maxPlayers,
        newMaxPlayers: updatedWorld.maxPlayers,
      });

      // Recalculate planned status if reservation limit changed
      if (updatedWorld.status === "planned_open" || updatedWorld.status === "planned_closed") {
        const countRes = await query("SELECT COUNT(*)::int as count FROM world_reservations WHERE world_id = $1", [id]);
        const resCount = countRes.rows[0].count;
        const targetStatus = resCount >= updatedWorld.maxPlayers ? "planned_closed" : "planned_open";
        if (targetStatus !== updatedWorld.status) {
          await query("UPDATE worlds SET status = $1 WHERE id = $2", [targetStatus, id]);
          updatedWorld.status = targetStatus;
        }
      }
    }

    if (startsAt && new Date(startsAt).getTime() !== new Date(world.startsAt).getTime()) {
      await logWorldAction(updatedWorld.id, updatedWorld.name, "SCHEDULE_UPDATED", authUser.id, authUser.username, {
        previousStartsAt: world.startsAt,
        newStartsAt: updatedWorld.startsAt,
      });
    }

    return res.json(updatedWorld);
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Admin - Delete World (Logs action before permanent removal)
app.delete("/api/admin/worlds/:id", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({
      code: ErrorCode.FORBIDDEN,
      message: "Access denied. Admin privileges required.",
    } as ApiErrorResponse);
  }

  const { id } = req.params;

  try {
    const worldRes = await query("SELECT id, name, status FROM worlds WHERE id = $1", [id]);
    if (worldRes.rows.length === 0) {
      return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "World not found." } as ApiErrorResponse);
    }

    const world = worldRes.rows[0];

    // Log deletion action before removing the world row so world_logs table holds ON DELETE SET NULL log
    await logWorldAction(world.id, world.name, "DELETED", authUser.id, authUser.username, {
      deletedWorldStatus: world.status,
    });

    await query("DELETE FROM worlds WHERE id = $1", [id]);

    return res.json({ message: `World '${world.name}' was completely deleted and audit log was preserved.` });
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

// Admin - Get World Audit Logs
app.get("/api/admin/world-logs", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
    return res.status(403).json({
      code: ErrorCode.FORBIDDEN,
      message: "Access denied. Admin privileges required.",
    } as ApiErrorResponse);
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

// World Reservation Endpoints
app.post("/api/worlds/:id/reserve", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({
      code: ErrorCode.UNAUTHORIZED,
      message: "Must be logged in to reserve a slot.",
    } as ApiErrorResponse);
  }

  const { id } = req.params;

  try {
    const worldRes = await query("SELECT id, status, max_players as \"maxPlayers\", is_test_only as \"isTestOnly\" FROM worlds WHERE id = $1", [id]);
    if (worldRes.rows.length === 0) {
      return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: "World not found." } as ApiErrorResponse);
    }

    const world = worldRes.rows[0];

    // Test-only world check
    if (world.isTestOnly) {
      const isTester = authUser.role === "tester" || authUser.role === "admin" || authUser.role === "super_admin";
      if (!isTester) {
        return res.status(403).json({
          code: ErrorCode.FORBIDDEN,
          message: "This is a test-only world accessible only by test users, admins, and super admins.",
        } as ApiErrorResponse);
      }
    }

    if (world.status !== "planned_open") {
      return res.status(400).json({
        code: ErrorCode.ACTION_NOT_ALLOWED,
        message: "Reservations are only open for worlds in 'planned_open' status.",
      } as ApiErrorResponse);
    }

    const countRes = await query("SELECT COUNT(*)::int as count FROM world_reservations WHERE world_id = $1", [id]);
    const currentCount = countRes.rows[0].count;
    if (currentCount >= world.maxPlayers) {
      return res.status(400).json({
        code: ErrorCode.ACTION_NOT_ALLOWED,
        message: "Reservation quota for this world is full.",
      } as ApiErrorResponse);
    }

    await query("INSERT INTO world_reservations (world_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, authUser.id]);

    // Check if max quota is reached after inserting
    const newCount = currentCount + 1;
    if (newCount >= world.maxPlayers) {
      await query("UPDATE worlds SET status = 'planned_closed' WHERE id = $1 AND status = 'planned_open'", [id]);
    }

    return res.json({ message: "Successfully reserved a spot for this game world!" });
  } catch (err: any) {
    return res.status(500).json({ code: ErrorCode.INTERNAL_ERROR, message: err.message } as ApiErrorResponse);
  }
});

app.delete("/api/worlds/:id/reserve", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({
      code: ErrorCode.UNAUTHORIZED,
      message: "Must be logged in to cancel reservation.",
    } as ApiErrorResponse);
  }

  const { id } = req.params;

  try {
    await query("DELETE FROM world_reservations WHERE world_id = $1 AND user_id = $2", [id, authUser.id]);

    // Check if slot freed up in planned_closed world
    const worldRes = await query("SELECT id, status, max_players as \"maxPlayers\" FROM worlds WHERE id = $1", [id]);
    if (worldRes.rows.length > 0) {
      const world = worldRes.rows[0];
      if (world.status === "planned_closed") {
        const countRes = await query("SELECT COUNT(*)::int as count FROM world_reservations WHERE world_id = $1", [id]);
        if (countRes.rows[0].count < world.maxPlayers) {
          await query("UPDATE worlds SET status = 'planned_open' WHERE id = $1", [id]);
        }
      }
    }

    return res.json({ message: "Reservation canceled successfully." });
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
              w.is_test_only as "isTestOnly", w.auto_close_days as "autoCloseDays", w.created_at as "createdAt",
              COALESCE(r.reserved_count, 0)::int as "reservedCount",
              CASE WHEN my_r.user_id IS NOT NULL THEN true ELSE false END as "isReservedByMe"
       FROM worlds w
       LEFT JOIN (
         SELECT world_id, COUNT(*) as reserved_count FROM world_reservations GROUP BY world_id
       ) r ON w.id = r.world_id
       LEFT JOIN world_reservations my_r ON w.id = my_r.world_id AND my_r.user_id = $1
       ORDER BY w.created_at DESC`,
      [authUser?.id || null]
    );

    // Filter out test-only worlds for regular users
    const isTester = authUser && (authUser.role === "tester" || authUser.role === "admin" || authUser.role === "super_admin");
    const filteredRows = dbRes.rows.filter((w) => !w.isTestOnly || isTester);

    return res.json(filteredRows);
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
