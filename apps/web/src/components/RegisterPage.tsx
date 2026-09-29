import React, { useState } from "react";
import { UserDto } from "@project-inferno/contracts";
import { ApiClient } from "@project-inferno/api-client";

interface RegisterPageProps {
  apiClient: ApiClient;
  onSuccess: (user: UserDto) => void;
  onNavigateToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ apiClient, onSuccess, onNavigateToLogin }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await apiClient.register({ username, email, passwordHash: password, termsAccepted });
      setMessage(res.message || "Account registered successfully!");
      if (res.user && res.user.status === "active") {
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "40px auto", padding: "24px", background: "#18181b", borderRadius: "10px", border: "1px solid #27272a", color: "#f8fafc" }}>
      <h2 style={{ margin: "0 0 16px 0", color: "#f97316" }}>Create Account</h2>

      {error && <div style={{ padding: "10px", backgroundColor: "#7f1d1d", color: "#fca5a5", borderRadius: "6px", marginBottom: "16px", fontSize: "14px" }}>{error}</div>}
      {message && <div style={{ padding: "10px", backgroundColor: "#113827", color: "#86efac", borderRadius: "6px", marginBottom: "16px", fontSize: "14px" }}>{message}</div>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #3f3f46", background: "#27272a", color: "#fff", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #3f3f46", background: "#27272a", color: "#fff", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Password (min 8 characters)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #3f3f46", background: "#27272a", color: "#fff", boxSizing: "border-box" }}
          />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#cbd5e1", marginTop: "4px" }}>
          <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} required />
          I accept the Terms of Service & Privacy Policy
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "12px", backgroundColor: "#f97316", color: "#ffffff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", marginTop: "8px" }}
        >
          {loading ? "Registering..." : "Register Account"}
        </button>
      </form>

      <div style={{ marginTop: "16px", textAlign: "center", fontSize: "14px", color: "#94a3b8" }}>
        Already have an account?{" "}
        <button onClick={onNavigateToLogin} style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
          Sign In
        </button>
      </div>
    </div>
  );
};
