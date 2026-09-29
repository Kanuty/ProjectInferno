import React from "react";
import { UserDto } from "@project-inferno/contracts";
import { InfernoApiClient } from "@project-inferno/api-client";
import { HealthStatus } from "./components/HealthStatus";
import { AccountShell } from "./components/AccountShell";
import { GameShell } from "./components/GameShell";

const apiClient = new InfernoApiClient(import.meta.env.VITE_API_URL || "http://localhost:3000");

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = React.useState<UserDto | null>(null);
  const [activeWorldId, setActiveWorldId] = React.useState<string | null>(null);
  const [activationMessage, setActivationMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("activationToken");
    if (token) {
      apiClient
        .activateAccount(token)
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
    }
  }, []);

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
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
          onExitWorld={() => setActiveWorldId(null)}
        />
      )}
    </div>
  );
};
