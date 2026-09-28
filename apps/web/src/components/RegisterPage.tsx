import React from "react";
import { InfernoApiClient } from "@project-inferno/api-client";
import { UserDto } from "@project-inferno/contracts";

interface RegisterPageProps {
  apiClient: InfernoApiClient;
  onSuccess: (user: UserDto) => void;
  onNavigateToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  apiClient,
  onSuccess,
  onNavigateToLogin,
}) => {
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!termsAccepted) {
      setError("You must accept the Terms of Service and Privacy Policy.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.register({
        username,
        email,
        passwordHash: password,
        termsAccepted,
      });
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || "Account registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "440px", margin: "24px auto", padding: "24px", background: "#18181b", borderRadius: "10px", border: "1px solid #27272a", color: "#f4f4f5" }}>
      <h2 style={{ margin: "0 0 8px 0", color: "#ff922b", textAlign: "center" }}>Create Account</h2>
      <p style={{ margin: "0 0 20px 0", color: "#a1a1aa", fontSize: "14px", textAlign: "center" }}>
        Join Project Inferno and forge your empire across persistent dark-fantasy worlds.
      </p>

      {error && (
        <div style={{ padding: "10px 14px", background: "#3f1315", border: "1px solid #7f1d1d", borderRadius: "6px", color: "#fca5a5", fontSize: "14px", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: "bold" }}>Username</label>
          <input
            type="text"
            placeholder="Choose a player username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #3f3f46", background: "#27272a", color: "#fff", boxSizing: "border-box" }}
            required
            minLength={3}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: "bold" }}>Email Address</label>
          <input
            type="email"
            placeholder="player@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #3f3f46", background: "#27272a", color: "#fff", boxSizing: "border-box" }}
            required
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: "bold" }}>Password</label>
          <input
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #3f3f46", background: "#27272a", color: "#fff", boxSizing: "border-box" }}
            required
            minLength={6}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: "bold" }}>Confirm Password</label>
          <input
            type="password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #3f3f46", background: "#27272a", color: "#fff", boxSizing: "border-box" }}
            required
            minLength={6}
          />
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "4px" }}>
          <input
            type="checkbox"
            id="terms"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            style={{ marginTop: "3px", cursor: "pointer" }}
            required
          />
          <label htmlFor="terms" style={{ fontSize: "13px", color: "#d4d4d8", cursor: "pointer" }}>
            I agree to the <span style={{ color: "#ff922b", textDecoration: "underline" }}>Terms of Service</span> and <span style={{ color: "#ff922b", textDecoration: "underline" }}>Privacy Policy</span>.
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "12px", background: loading ? "#52525b" : "#ff922b", color: "#000", fontWeight: "bold", border: "none", borderRadius: "6px", cursor: loading ? "not-allowed" : "pointer", fontSize: "15px", marginTop: "8px" }}
        >
          {loading ? "Creating Account..." : "Register Account"}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: "20px", borderTop: "1px solid #27272a", paddingTop: "16px" }}>
        <span style={{ fontSize: "14px", color: "#a1a1aa" }}>Already have an account? </span>
        <button
          onClick={onNavigateToLogin}
          style={{ background: "none", border: "none", color: "#ff922b", cursor: "pointer", fontWeight: "bold", padding: 0, fontSize: "14px" }}
        >
          Sign In
        </button>
      </div>
    </div>
  );
};
