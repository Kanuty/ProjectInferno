import React from "react";
import { UserDto, WorldDto } from "@project-inferno/contracts";
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
      </p>

      {error && <p style={{ color: "#ff6b6b", fontSize: "14px" }}>{error}</p>}

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
