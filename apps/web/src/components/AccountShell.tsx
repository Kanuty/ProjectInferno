import React from "react";
import { UserDto, WorldDto, EmailLogDto } from "@project-inferno/contracts";
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
  const [adminTab, setAdminTab] = React.useState<"accounts" | "emailLogs">("accounts");
  const [adminMessage, setAdminMessage] = React.useState<string | null>(null);
  const [adminError, setAdminError] = React.useState<string | null>(null);

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
      if (currentUser.role === "admin") {
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
        Welcome back, <strong style={{ color: "#ff922b" }}>{currentUser.username}</strong> ({currentUser.email})
        {currentUser.role === "admin" && (
          <span style={{ marginLeft: "8px", padding: "2px 8px", background: "#7c2d12", color: "#fdba74", borderRadius: "4px", fontSize: "12px", fontWeight: "bold" }}>
            ADMIN
          </span>
        )}
      </p>

      {error && <p style={{ color: "#ff6b6b", fontSize: "14px" }}>{error}</p>}

      {currentUser.role === "admin" && (
        <div style={{ marginTop: "20px", marginBottom: "24px", borderTop: "1px solid #27272a", paddingTop: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h4 style={{ margin: 0, color: "#f97316" }}>Admin Dashboard</h4>
            <div style={{ display: "flex", gap: "8px" }}>
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
                  fontSize: "13px",
                }}
              >
                Accounts
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
                  fontSize: "13px",
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
                    {adminUsers.map((u) => (
                      <tr key={u.id} style={{ borderBottom: "1px solid #27272a" }}>
                        <td style={{ padding: "10px" }}>{u.username}</td>
                        <td style={{ padding: "10px" }}>{u.email}</td>
                        <td style={{ padding: "10px" }}>
                          <span style={{ color: u.role === "admin" ? "#f97316" : "#a1a1aa", fontWeight: u.role === "admin" ? "bold" : "normal" }}>
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
                          {u.id !== currentUser.id && (
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
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
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
          {worlds.map((w) => (
            <li key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#27272a", marginBottom: "8px", borderRadius: "6px" }}>
              <span>
                <strong>{w.name}</strong> <small style={{ color: "#a1a1aa" }}>({w.status})</small>
              </span>
              <button
                onClick={() => onSelectWorld(w.id)}
                style={{ padding: "8px 16px", background: "#ff922b", color: "#000", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
              >
                Enter World
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
