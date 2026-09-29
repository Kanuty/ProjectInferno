import React from "react";
import { InfernoApiClient } from "@project-inferno/api-client";
import { UserDto } from "@project-inferno/contracts";

interface LoginPageProps {
  apiClient: InfernoApiClient;
  onSuccess: (user: UserDto) => void;
  onNavigateToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  apiClient,
  onSuccess,
  onNavigateToRegister,
}) => {
  const [login, setLogin] = React.useState("test@example.com");
  const [password, setPassword] = React.useState("password123");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      const res = await apiClient.login({
        login: login.trim(),
        passwordHash: password,
      });
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "440px", margin: "24px auto", padding: "24px", background: "#18181b", borderRadius: "10px", border: "1px solid #27272a", color: "#f4f4f5" }}>
      <h2 style={{ margin: "0 0 8px 0", color: "#ff922b", textAlign: "center" }}>Account Sign In</h2>
      <p style={{ margin: "0 0 20px 0", color: "#a1a1aa", fontSize: "14px", textAlign: "center" }}>
        Authenticate to access your account dashboard and active game worlds.
      </p>

      {error && (
        <div style={{ padding: "10px 14px", background: "#3f1315", border: "1px solid #7f1d1d", borderRadius: "6px", color: "#fca5a5", fontSize: "14px", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: "bold" }}>Username or Email</label>
          <input
            type="text"
            placeholder="Username or email address"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #3f3f46", background: "#27272a", color: "#fff", boxSizing: "border-box" }}
            required
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: "bold" }}>Password</label>
          <input
            type="password"
            placeholder="Your password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #3f3f46", background: "#27272a", color: "#fff", boxSizing: "border-box" }}
            required
            minLength={8}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "12px", background: loading ? "#52525b" : "#ff922b", color: "#000", fontWeight: "bold", border: "none", borderRadius: "6px", cursor: loading ? "not-allowed" : "pointer", fontSize: "15px", marginTop: "8px" }}
        >
          {loading ? "Authenticating..." : "Sign In"}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: "20px", borderTop: "1px solid #27272a", paddingTop: "16px" }}>
        <span style={{ fontSize: "14px", color: "#a1a1aa" }}>Need a new account? </span>
        <button
          onClick={onNavigateToRegister}
          style={{ background: "none", border: "none", color: "#ff922b", cursor: "pointer", fontWeight: "bold", padding: 0, fontSize: "14px" }}
        >
          Create Account Here
        </button>
      </div>
    </div>
  );
};
