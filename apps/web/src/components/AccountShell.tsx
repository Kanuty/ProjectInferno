import React from "react";
import { UserDto, WorldDto, EmailLogDto, WorldStageStatus } from "@project-inferno/contracts";
import { InfernoApiClient } from "@project-inferno/api-client";
import { RegisterPage } from "./RegisterPage.js";
import { LoginPage } from "./LoginPage.js";

interface AccountShellProps {
  apiClient: InfernoApiClient;
  currentUser: UserDto | null;
  onLoginSuccess: (user: UserDto) => void;
  onSelectWorld: (worldId: string) => void;
}

type AuthView = "login" | "register";

export const AccountShell: React.FC<AccountShellProps> = ({
  apiClient,
  currentUser,
  onLoginSuccess,
  onSelectWorld,
}) => {
  const [authView, setAuthView] = React.useState<AuthView>("login");
  const [worlds, setWorlds] = React.useState<WorldDto[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Admin state
  const [adminUsers, setAdminUsers] = React.useState<UserDto[]>([]);
  const [emailLogs, setEmailLogs] = React.useState<EmailLogDto[]>([]);
  const [adminTab, setAdminTab] = React.useState<"accounts" | "createUser" | "worlds" | "emailLogs">("accounts");
  const [adminMessage, setAdminMessage] = React.useState<string | null>(null);
  const [adminError, setAdminError] = React.useState<string | null>(null);

  // Manual create user form state
  const [newUsername, setNewUsername] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");
  const [newRole, setNewRole] = React.useState<"user" | "tester" | "admin" | "super_admin">("user");

  // Create world form state
  const [newWorldName, setNewWorldName] = React.useState("");
  const [newWorldStartsAt, setNewWorldStartsAt] = React.useState("");
  const [newWorldMaxPlayers, setNewWorldMaxPlayers] = React.useState(100);
  const [newWorldIsTestOnly, setNewWorldIsTestOnly] = React.useState(false);
  const [newWorldAutoCloseDays, setNewWorldAutoCloseDays] = React.useState(20);
  const [newWorldStatus, setNewWorldStatus] = React.useState<WorldStageStatus>("planned_open");

  const handleAdminCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMessage(null);
    setAdminError(null);
    try {
      const created = await apiClient.adminCreateUser({
        username: newUsername.trim(),
        passwordHash: newPassword,
        email: newEmail.trim() || undefined,
        role: newRole,
      });
      setAdminMessage(`Account ${created.username} (${created.role}) successfully created.`);
      setNewUsername("");
      setNewPassword("");
      setNewEmail("");
      await loadAdminUsers();
      setAdminTab("accounts");
    } catch (err: any) {
      setAdminError(err.message || "Failed to create user.");
    }
  };

  const handleAdminCreateWorld = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMessage(null);
    setAdminError(null);
    try {
      const world = await apiClient.adminCreateWorld({
        name: newWorldName.trim(),
        startsAt: newWorldStartsAt ? new Date(newWorldStartsAt).toISOString() : undefined,
        maxPlayers: newWorldMaxPlayers,
        isTestOnly: newWorldIsTestOnly,
        autoCloseDays: newWorldAutoCloseDays,
        status: newWorldStatus,
      });
      setAdminMessage(`World '${world.name}' scheduled in '${world.status}' state.`);
      setNewWorldName("");
      setNewWorldStartsAt("");
      await loadWorlds();
    } catch (err: any) {
      setAdminError(err.message || "Failed to create world.");
    }
  };

  const handleUpdateWorldStatus = async (worldId: string, status: WorldStageStatus) => {
    setAdminMessage(null);
    setAdminError(null);
    try {
      await apiClient.adminUpdateWorldStatus(worldId, status);
      setAdminMessage(`World status updated to '${status}'.`);
      await loadWorlds();
    } catch (err: any) {
      setAdminError(err.message || "Failed to update world status.");
    }
  };

  const handleReserveWorldSlot = async (worldId: string) => {
    try {
      const res = await apiClient.reserveWorldSlot(worldId);
      alert(res.message);
      await loadWorlds();
    } catch (err: any) {
      alert(err.message || "Failed to reserve slot.");
    }
  };

  const handleCancelWorldReservation = async (worldId: string) => {
    try {
      const res = await apiClient.cancelWorldReservation(worldId);
      alert(res.message);
      await loadWorlds();
    } catch (err: any) {
      alert(err.message || "Failed to cancel reservation.");
    }
  };

  const loadAdminUsers = async () => {
    try {
      const users = await apiClient.adminGetAllUsers();
      setAdminUsers(users);
    } catch (err: any) {
      setAdminError("Failed to fetch user accounts.");
    }
  };

  const loadEmailLogs = async () => {
    try {
      const logs = await apiClient.adminGetEmailLogs();
      setEmailLogs(logs);
    } catch (err: any) {
      setAdminError("Failed to fetch email logs.");
    }
  };

  const handleToggleBlockUser = async (user: UserDto) => {
    setAdminMessage(null);
    setAdminError(null);
    const newStatus = user.status === "suspended" ? "active" : "suspended";
    try {
      await apiClient.adminBlockUser(user.id, newStatus);
      setAdminMessage(`User ${user.username} is now ${newStatus}.`);
      await loadAdminUsers();
      await loadEmailLogs();
    } catch (err: any) {
      setAdminError(err.message || "Failed to update user status.");
    }
  };

  const handleDeleteUser = async (user: UserDto) => {
    if (!window.confirm(`Are you sure you want to delete user ${user.username} (${user.email})? An email notification will be sent.`)) {
      return;
    }
    setAdminMessage(null);
    setAdminError(null);
    try {
      const res = await apiClient.adminDeleteUser(user.id);
      setAdminMessage(res.message);
      await loadAdminUsers();
      await loadEmailLogs();
    } catch (err: any) {
      setAdminError(err.message || "Failed to delete user.");
    }
  };

  const loadWorlds = async () => {
    try {
      const data = await apiClient.getWorlds();
      setWorlds(data);
    } catch (err: any) {
      setError("Failed to fetch game worlds.");
    }
  };

  React.useEffect(() => {
    if (currentUser) {
      loadWorlds();
      if (currentUser.role === "admin" || currentUser.role === "super_admin") {
        loadAdminUsers();
        loadEmailLogs();
      }
    }
  }, [currentUser]);

  if (!currentUser) {
    if (authView === "register") {
      return (
        <RegisterPage
          apiClient={apiClient}
          onSuccess={onLoginSuccess}
          onNavigateToLogin={() => setAuthView("login")}
        />
      );
    }

    return (
      <LoginPage
        apiClient={apiClient}
        onSuccess={onLoginSuccess}
        onNavigateToRegister={() => setAuthView("register")}
      />
    );
  }

  return (
    <div style={{ padding: "20px", background: "#18181b", borderRadius: "10px", border: "1px solid #27272a", marginBottom: "16px" }}>
      <h3 style={{ margin: "0 0 12px 0", color: "#ff922b" }}>Account Dashboard</h3>
      <p style={{ margin: "0 0 16px 0", color: "#e4e4e7" }}>
        Welcome back, <strong style={{ color: "#ff922b" }}>{currentUser.username}</strong> ({currentUser.email || "No Email Associated"})
        {(currentUser.role === "admin" || currentUser.role === "super_admin" || currentUser.role === "tester") && (
          <span style={{ marginLeft: "8px", padding: "2px 8px", background: currentUser.role === "super_admin" ? "#991b1b" : currentUser.role === "admin" ? "#7c2d12" : "#1e3a8a", color: "#fdba74", borderRadius: "4px", fontSize: "12px", fontWeight: "bold" }}>
            {currentUser.role === "super_admin" ? "SUPER ADMIN" : currentUser.role === "admin" ? "ADMIN" : "TESTER"}
          </span>
        )}
      </p>

      {error && <p style={{ color: "#ff6b6b", fontSize: "14px" }}>{error}</p>}

      {(currentUser.role === "admin" || currentUser.role === "super_admin") && (
        <div style={{ marginTop: "20px", marginBottom: "24px", borderTop: "1px solid #27272a", paddingTop: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h4 style={{ margin: 0, color: "#f97316" }}>Admin Console & Developer Dashboard</h4>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button
                onClick={() => setAdminTab("accounts")}
                style={{
                  padding: "6px 12px",
                  background: adminTab === "accounts" ? "#f97316" : "#27272a",
                  color: adminTab === "accounts" ? "#000" : "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Accounts ({adminUsers.length})
              </button>
              <button
                onClick={() => setAdminTab("createUser")}
                style={{
                  padding: "6px 12px",
                  background: adminTab === "createUser" ? "#f97316" : "#27272a",
                  color: adminTab === "createUser" ? "#000" : "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                + Create User
              </button>
              <button
                onClick={() => setAdminTab("worlds")}
                style={{
                  padding: "6px 12px",
                  background: adminTab === "worlds" ? "#f97316" : "#27272a",
                  color: adminTab === "worlds" ? "#000" : "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                World Lifecycle
              </button>
              <button
                onClick={() => { setAdminTab("emailLogs"); loadEmailLogs(); }}
                style={{
                  padding: "6px 12px",
                  background: adminTab === "emailLogs" ? "#f97316" : "#27272a",
                  color: adminTab === "emailLogs" ? "#000" : "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Email Logs ({emailLogs.length})
              </button>
            </div>
          </div>

          {adminMessage && (
            <div style={{ padding: "10px 14px", background: "#113827", border: "1px solid #166534", borderRadius: "6px", color: "#86efac", fontSize: "14px", marginBottom: "12px" }}>
              {adminMessage}
            </div>
          )}

          {adminError && (
            <div style={{ padding: "10px 14px", background: "#3f1315", border: "1px solid #7f1d1d", borderRadius: "6px", color: "#fca5a5", fontSize: "14px", marginBottom: "12px" }}>
              {adminError}
            </div>
          )}

          {adminTab === "accounts" ? (
            adminUsers.length === 0 ? (
              <p style={{ color: "#a1a1aa", fontSize: "14px" }}>Loading accounts...</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", color: "#e4e4e7", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ background: "#27272a", textAlign: "left" }}>
                      <th style={{ padding: "10px", borderBottom: "1px solid #3f3f46" }}>Username</th>
                      <th style={{ padding: "10px", borderBottom: "1px solid #3f3f46" }}>Email</th>
                      <th style={{ padding: "10px", borderBottom: "1px solid #3f3f46" }}>Role</th>
                      <th style={{ padding: "10px", borderBottom: "1px solid #3f3f46" }}>Status</th>
                      <th style={{ padding: "10px", borderBottom: "1px solid #3f3f46" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                  {adminUsers.map((u) => {
                    const isProtected = u.role === "super_admin" || u.username.toLowerCase() === "inferno";
                    return (
                      <tr key={u.id} style={{ borderBottom: "1px solid #27272a" }}>
                        <td style={{ padding: "10px", fontWeight: isProtected ? "bold" : "normal" }}>{u.username}</td>
                        <td style={{ padding: "10px" }}>{u.email || <em style={{ color: "#71717a" }}>None</em>}</td>
                        <td style={{ padding: "10px" }}>
                          <span style={{ color: u.role === "super_admin" ? "#ef4444" : u.role === "admin" ? "#f97316" : "#a1a1aa", fontWeight: u.role ? "bold" : "normal" }}>
                            {u.role || "user"}
                          </span>
                        </td>
                        <td style={{ padding: "10px" }}>
                          <span style={{
                            color: u.status === "active" ? "#86efac" : u.status === "suspended" ? "#fca5a5" : "#fef08a",
                            fontWeight: "bold"
                          }}>
                            {u.status}
                          </span>
                        </td>
                        <td style={{ padding: "10px", display: "flex", gap: "8px" }}>
                          {isProtected ? (
                            <span style={{ fontSize: "12px", color: "#a1a1aa", fontStyle: "italic" }}>Protected Account</span>
                          ) : u.id !== currentUser.id ? (
                            <>
                              <button
                                onClick={() => handleToggleBlockUser(u)}
                                style={{
                                  padding: "4px 10px",
                                  background: u.status === "suspended" ? "#166534" : "#854d0e",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                {u.status === "suspended" ? "Unblock" : "Block"}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                style={{
                                  padding: "4px 10px",
                                  background: "#991b1b",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Delete
                              </button>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            )
          ) : adminTab === "createUser" ? (
            <div style={{ background: "#27272a", padding: "16px", borderRadius: "8px" }}>
              <h5 style={{ margin: "0 0 12px 0", color: "#ff922b", fontSize: "15px" }}>Manually Create User Account</h5>
              <form onSubmit={handleAdminCreateUser} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Username *</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #3f3f46", background: "#18181b", color: "#fff", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Password *</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #3f3f46", background: "#18181b", color: "#fff", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Email Address (Optional)</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Leave empty for no email"
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #3f3f46", background: "#18181b", color: "#fff", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Account Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #3f3f46", background: "#18181b", color: "#fff", boxSizing: "border-box" }}
                  >
                    <option value="user">User</option>
                    <option value="tester">Tester</option>
                    <option value="admin">Admin</option>
                    {currentUser.role === "super_admin" && <option value="super_admin">Super Admin</option>}
                  </select>
                </div>
                <div style={{ gridColumn: "span 2", marginTop: "8px" }}>
                  <button type="submit" style={{ padding: "8px 16px", background: "#ff922b", color: "#000", fontWeight: "bold", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                    Create Account
                  </button>
                </div>
              </form>
            </div>
          ) : adminTab === "worlds" ? (
            <div>
              <div style={{ background: "#27272a", padding: "16px", borderRadius: "8px", marginBottom: "16px" }}>
                <h5 style={{ margin: "0 0 12px 0", color: "#ff922b", fontSize: "15px" }}>Schedule & Create New Game World</h5>
                <form onSubmit={handleAdminCreateWorld} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>World Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. World Epsilon"
                      value={newWorldName}
                      onChange={(e) => setNewWorldName(e.target.value)}
                      required
                      style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #3f3f46", background: "#18181b", color: "#fff", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Scheduled Start Date/Time</label>
                    <input
                      type="datetime-local"
                      value={newWorldStartsAt}
                      onChange={(e) => setNewWorldStartsAt(e.target.value)}
                      style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #3f3f46", background: "#18181b", color: "#fff", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Max Player Capacity</label>
                    <input
                      type="number"
                      value={newWorldMaxPlayers}
                      onChange={(e) => setNewWorldMaxPlayers(parseInt(e.target.value) || 100)}
                      min={1}
                      style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #3f3f46", background: "#18181b", color: "#fff", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Auto-Close Timer (Days)</label>
                    <input
                      type="number"
                      value={newWorldAutoCloseDays}
                      onChange={(e) => setNewWorldAutoCloseDays(parseInt(e.target.value) || 20)}
                      min={1}
                      style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #3f3f46", background: "#18181b", color: "#fff", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Initial Stage Status</label>
                    <select
                      value={newWorldStatus}
                      onChange={(e) => setNewWorldStatus(e.target.value as any)}
                      style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #3f3f46", background: "#18181b", color: "#fff", boxSizing: "border-box" }}
                    >
                      <option value="planned_open">Planned - Open Reservation</option>
                      <option value="planned_closed">Planned - Closed Reservation</option>
                      <option value="active">Active (Playable)</option>
                      <option value="active_closed">Active - Closed to New Joiners</option>
                      <option value="suspended">Suspended (Frozen)</option>
                      <option value="archived">Archived (Closed)</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="checkbox"
                      id="isTestOnly"
                      checked={newWorldIsTestOnly}
                      onChange={(e) => setNewWorldIsTestOnly(e.target.checked)}
                    />
                    <label htmlFor="isTestOnly" style={{ fontSize: "13px", color: "#93c5fd" }}>
                      <strong>Test-Only World</strong> (Accessible only by tester users, admins, and super admins)
                    </label>
                  </div>
                  <div style={{ gridColumn: "span 2", marginTop: "8px" }}>
                    <button type="submit" style={{ padding: "8px 16px", background: "#ff922b", color: "#000", fontWeight: "bold", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                      Schedule & Create World
                    </button>
                  </div>
                </form>
              </div>

              {/* Developer Console State Reference Card */}
              <div style={{ background: "#18181b", padding: "12px", borderRadius: "6px", border: "1px solid #3f3f46", marginBottom: "16px", fontSize: "12px", color: "#a1a1aa" }}>
                <strong style={{ color: "#ff922b" }}>[Admin Developer Console] World Stage Lifecycle Reference:</strong>
                <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                  <li><strong>planned_open:</strong> World scheduled in future. Players can reserve right to play.</li>
                  <li><strong>planned_closed:</strong> World scheduled in future, but new player reservations are locked.</li>
                  <li><strong>active:</strong> World currently live and open for gameplay and registration.</li>
                  <li><strong>active_closed:</strong> World actively running, but no new players can join.</li>
                  <li><strong>suspended:</strong> World state frozen in time for maintenance/admin review.</li>
                  <li><strong>archived:</strong> World permanently closed; read-only history.</li>
                </ul>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", color: "#e4e4e7", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#27272a", textAlign: "left" }}>
                      <th style={{ padding: "8px", borderBottom: "1px solid #3f3f46" }}>World Name</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid #3f3f46" }}>Start Time</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid #3f3f46" }}>Reservations</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid #3f3f46" }}>Current Stage</th>
                      <th style={{ padding: "8px", borderBottom: "1px solid #3f3f46" }}>Change Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {worlds.map((w) => (
                      <tr key={w.id} style={{ borderBottom: "1px solid #27272a" }}>
                        <td style={{ padding: "8px", fontWeight: "bold" }}>{w.name}</td>
                        <td style={{ padding: "8px", color: "#a1a1aa" }}>{w.startsAt ? new Date(w.startsAt).toLocaleString() : "Immediate"}</td>
                        <td style={{ padding: "8px" }}>{w.reservedCount || 0} / {w.maxPlayers || 100}</td>
                        <td style={{ padding: "8px", fontWeight: "bold", color: w.status === "active" ? "#86efac" : w.status.startsWith("planned") ? "#fdba74" : "#fca5a5" }}>
                          {w.status}
                        </td>
                        <td style={{ padding: "8px" }}>
                          <select
                            value={w.status}
                            onChange={(e) => handleUpdateWorldStatus(w.id, e.target.value as WorldStageStatus)}
                            style={{ padding: "4px 8px", borderRadius: "4px", background: "#27272a", color: "#fff", border: "1px solid #3f3f46" }}
                          >
                            <option value="planned_open">planned_open</option>
                            <option value="planned_closed">planned_closed</option>
                            <option value="active">active</option>
                            <option value="active_closed">active_closed</option>
                            <option value="suspended">suspended</option>
                            <option value="archived">archived</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", color: "#a1a1aa" }}>System Email Audit Log</span>
                <button
                  onClick={loadEmailLogs}
                  style={{ padding: "4px 8px", background: "#3f3f46", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                >
                  Refresh Logs
                </button>
              </div>
              {emailLogs.length === 0 ? (
                <p style={{ color: "#a1a1aa", fontSize: "14px" }}>No email log entries recorded yet.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", color: "#e4e4e7", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#27272a", textAlign: "left" }}>
                        <th style={{ padding: "8px", borderBottom: "1px solid #3f3f46" }}>Recipient Email</th>
                        <th style={{ padding: "8px", borderBottom: "1px solid #3f3f46" }}>Sender Address</th>
                        <th style={{ padding: "8px", borderBottom: "1px solid #3f3f46" }}>Subject (Topic)</th>
                        <th style={{ padding: "8px", borderBottom: "1px solid #3f3f46" }}>Status</th>
                        <th style={{ padding: "8px", borderBottom: "1px solid #3f3f46" }}>Sent At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: "1px solid #27272a" }}>
                          <td style={{ padding: "8px" }}>{log.recipientEmail}</td>
                          <td style={{ padding: "8px", color: "#a1a1aa" }}>{log.senderEmail}</td>
                          <td style={{ padding: "8px", fontWeight: "bold" }}>{log.subject}</td>
                          <td style={{ padding: "8px" }}>
                            <span style={{ color: log.status === "success" ? "#86efac" : "#fca5a5", fontWeight: "bold" }}>
                              {log.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: "8px", color: "#a1a1aa" }}>
                            {new Date(log.sentAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <h4 style={{ margin: "16px 0 12px 0", borderTop: "1px solid #27272a", paddingTop: "12px" }}>Select Game World</h4>
      {worlds.length === 0 ? (
        <p style={{ color: "#a1a1aa", fontSize: "14px" }}>No active worlds available or loading worlds...</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {worlds.map((w) => {
            const isPlayable = w.status === "active" || w.status === "active_closed";
            const isReservable = w.status === "planned_open";
            const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

            return (
              <li key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#27272a", marginBottom: "8px", borderRadius: "6px" }}>
                <div>
                  <strong>{w.name}</strong>{" "}
                  <span style={{ fontSize: "12px", padding: "2px 6px", background: "#3f3f46", color: "#fdba74", borderRadius: "4px", marginLeft: "6px" }}>
                    Stage: {w.status}
                  </span>
                  {w.isTestOnly && (
                    <span style={{ fontSize: "11px", padding: "2px 6px", background: "#1e3a8a", color: "#93c5fd", borderRadius: "4px", marginLeft: "6px", fontWeight: "bold" }}>
                      TEST-ONLY
                    </span>
                  )}
                  {w.startsAt && (
                    <div style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "4px" }}>
                      Starts At: {new Date(w.startsAt).toLocaleString()} ({userTimeZone})
                    </div>
                  )}
                  {w.status.startsWith("planned") && (
                    <div style={{ fontSize: "12px", color: "#a1a1aa" }}>
                      Reservations: {w.reservedCount || 0} / {w.maxPlayers || 100} players
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  {isPlayable ? (
                    <button
                      onClick={() => onSelectWorld(w.id)}
                      style={{ padding: "8px 16px", background: "#ff922b", color: "#000", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                    >
                      Enter World
                    </button>
                  ) : isReservable ? (
                    w.isReservedByMe ? (
                      <button
                        onClick={() => handleCancelWorldReservation(w.id)}
                        style={{ padding: "8px 16px", background: "#991b1b", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        Cancel Reservation
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReserveWorldSlot(w.id)}
                        style={{ padding: "8px 16px", background: "#166534", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        Reserve Right to Play
                      </button>
                    )
                  ) : (
                    <span style={{ fontSize: "13px", color: "#a1a1aa", fontStyle: "italic" }}>
                      {w.status === "planned_closed" ? "Reservation Closed" : "World Unavailable"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
