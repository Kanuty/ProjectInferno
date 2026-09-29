import React, { useState } from "react";
import { UserDto } from "@project-inferno/contracts";
import { ApiClient } from "@project-inferno/api-client";

interface LoginPageProps {
  apiClient: ApiClient;
  onSuccess: (user: UserDto) => void;
  onNavigateToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ apiClient, onSuccess, onNavigateToRegister }) => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiClient.login({ login, passwordHash: password });
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "24px", background: "#18181b", borderRadius: "10px", border: "1px solid #27272a", color: "#f8fafc" }}>
      <h2 style={{ margin: "0 0 16px 0", color: "#f97316" }}>Sign In</h2>

      {error && <div style={{ padding: "10px", backgroundColor: "#7f1d1d", color: "#fca5a5", borderRadius: "6px", marginBottom: "16px", fontSize: "14px" }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Username or Email</label>
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #3f3f46", background: "#27272a", color: "#fff", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #3f3f46", background: "#27272a", color: "#fff", boxSizing: "border-box" }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "12px", backgroundColor: "#f97316", color: "#ffffff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", marginTop: "8px" }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div style={{ marginTop: "16px", textAlign: "center", fontSize: "14px", color: "#94a3b8" }}>
        Don't have an account?{" "}
        <button onClick={onNavigateToRegister} style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
          Register
        </button>
      </div>
    </div>
  );
};
