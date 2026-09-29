import React from "react";
import { UserDto } from "@project-inferno/contracts";
import { ApiClient } from "@project-inferno/api-client";
import { HealthStatus } from "./components/HealthStatus";
import { AccountShell } from "./components/AccountShell";
import { GameShell } from "./components/GameShell";

const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = React.useState<UserDto | null>(null);
  const [activeWorldId, setActiveWorldId] = React.useState<string | null>(null);
  const [activationMessage, setActivationMessage] = React.useState<string | null>(null);

  // Password reset state
  const [resetToken, setResetToken] = React.useState<string | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [resetStatusMessage, setResetStatusMessage] = React.useState<string | null>(null);
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [resetLoading, setResetLoading] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("activationToken");
    const rToken = params.get("resetToken");

    if (token) {
      apiClient
        .activate({ token })
        .then((res) => {
          setActivationMessage(res.message || "Account successfully activated!");
          if (res.user) {
            setCurrentUser(res.user);
          }
        })
        .catch((err) => {
          setActivationMessage(`Activation Error: ${err.message || "Invalid token"}`);
        })
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    } else if (rToken) {
      setResetToken(rToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) return;
    setResetError(null);
    setResetStatusMessage(null);
    setResetLoading(true);

    try {
      const res = await apiClient.resetPassword({ token: resetToken, newPasswordHash: newPassword });
      setResetStatusMessage(res.message);
      setResetToken(null);
    } catch (err: any) {
      setResetError(err.message || "Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
      <header style={{ borderBottom: "1px solid #333", paddingBottom: "12px", marginBottom: "20px" }}>
        <h1 style={{ margin: 0, color: "#ff922b" }}>PROJECT INFERNO</h1>
        <p style={{ margin: "4px 0 0 0", color: "#888" }}>Persistent Strategy Game Baseline Architecture</p>
      </header>

      <HealthStatus apiClient={apiClient} />

      {activationMessage && (
        <div style={{ padding: "12px 16px", background: "#113827", border: "1px solid #166534", borderRadius: "8px", color: "#86efac", marginBottom: "16px", fontSize: "14px" }}>
          {activationMessage}
        </div>
      )}

      {resetStatusMessage && (
        <div style={{ padding: "12px 16px", background: "#113827", border: "1px solid #166534", borderRadius: "8px", color: "#86efac", marginBottom: "16px", fontSize: "14px" }}>
          {resetStatusMessage}
        </div>
      )}

      {resetToken && (
        <div style={{ maxWidth: "440px", margin: "24px auto", padding: "24px", background: "#18181b", borderRadius: "10px", border: "1px solid #27272a", color: "#f4f4f5", marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 12px 0", color: "#ff922b" }}>Set New Password</h3>
          <p style={{ margin: "0 0 16px 0", color: "#a1a1aa", fontSize: "14px" }}>
            Please enter your new password below (min 8 characters).
          </p>

          {resetError && (
            <div style={{ padding: "10px 14px", background: "#3f1315", border: "1px solid #7f1d1d", borderRadius: "6px", color: "#fca5a5", fontSize: "14px", marginBottom: "16px" }}>
              {resetError}
            </div>
          )}

          <form onSubmit={handleResetPasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #3f3f46", background: "#27272a", color: "#fff", boxSizing: "border-box" }}
              required
              minLength={8}
            />
            <button
              type="submit"
              disabled={resetLoading}
              style={{ padding: "10px", background: "#ff922b", color: "#000", fontWeight: "bold", border: "none", borderRadius: "6px", cursor: "pointer" }}
            >
              {resetLoading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      )}

      {!activeWorldId ? (
        <AccountShell
          apiClient={apiClient}
          currentUser={currentUser}
          onLoginSuccess={(user) => setCurrentUser(user)}
          onSelectWorld={(worldId) => setActiveWorldId(worldId)}
        />
      ) : (
        <GameShell
          apiClient={apiClient}
          worldId={activeWorldId}
          currentUserId={currentUser?.id || ""}
          onExitWorld={() => setActiveWorldId(null)}
        />
      )}
    </div>
  );
};
