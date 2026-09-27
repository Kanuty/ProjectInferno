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

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <header style={{ borderBottom: "1px solid #333", paddingBottom: "12px", marginBottom: "20px" }}>
        <h1 style={{ margin: 0, color: "#ff922b" }}>PROJECT INFERNO</h1>
        <p style={{ margin: "4px 0 0 0", color: "#888" }}>Persistent Strategy Game Baseline Architecture</p>
      </header>

      <HealthStatus apiClient={apiClient} />

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
