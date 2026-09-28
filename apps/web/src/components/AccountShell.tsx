import React from "react";
import { UserDto, WorldDto } from "@project-inferno/contracts";
import { InfernoApiClient } from "@project-inferno/api-client";

interface AccountShellProps {
  apiClient: InfernoApiClient;
  currentUser: UserDto | null;
  onLoginSuccess: (user: UserDto) => void;
  onSelectWorld: (worldId: string) => void;
}

export const AccountShell: React.FC<AccountShellProps> = ({
  apiClient,
  currentUser,
  onLoginSuccess,
  onSelectWorld,
}) => {
  const [email, setEmail] = React.useState("test@example.com");
  const [username, setUsername] = React.useState("player1");
  const [password, setPassword] = React.useState("password123");
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [worlds, setWorlds] = React.useState<WorldDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegistering) {
        const res = await apiClient.register({ username, email, passwordHash: password });
        onLoginSuccess(res.user);
      } else {
        const res = await apiClient.login({ email, passwordHash: password });
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
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
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div style={{ maxWidth: "400px", margin: "20px auto", padding: "20px", background: "#1e1e1e", borderRadius: "8px" }}>
        <h3>Account Portal ({isRegistering ? "Register" : "Login"})</h3>
        {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}
        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {isRegistering && (
            <div>
              <label style={{ display: "block", marginBottom: "4px" }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                required
              />
            </div>
          )}
          <div>
            <label style={{ display: "block", marginBottom: "4px" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              required
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "4px" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              required
            />
          </div>
          <button type="submit" disabled={loading} style={{ padding: "10px", background: "#339af0", color: "#fff", border: "none", borderRadius: "4px" }}>
            {loading ? "Processing..." : isRegistering ? "Create Account" : "Log In"}
          </button>
        </form>
        <button
          onClick={() => setIsRegistering(!isRegistering)}
          style={{ marginTop: "12px", background: "none", border: "none", color: "#74c0fc", cursor: "pointer", padding: 0 }}
        >
          {isRegistering ? "Already have an account? Log in" : "Need an account? Register"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", background: "#1e1e1e", borderRadius: "8px", marginBottom: "16px" }}>
      <h3>Account Dashboard</h3>
      <p>Welcome, <strong>{currentUser.username}</strong> ({currentUser.email})</p>

      <h4>Select Game World</h4>
      {worlds.length === 0 ? (
        <p style={{ color: "#aaa" }}>No active worlds available or loading worlds...</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {worlds.map((w) => (
            <li key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#2b2b2b", marginBottom: "8px", borderRadius: "4px" }}>
              <span>{w.name} ({w.status})</span>
              <button
                onClick={() => onSelectWorld(w.id)}
                style={{ padding: "6px 12px", background: "#51cf66", color: "#000", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
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
