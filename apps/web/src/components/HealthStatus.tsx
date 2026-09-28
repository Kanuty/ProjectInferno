import React from "react";
import { HealthCheckResponse } from "@project-inferno/contracts";
import { InfernoApiClient } from "@project-inferno/api-client";

interface HealthStatusProps {
  apiClient: InfernoApiClient;
}

export const HealthStatus: React.FC<HealthStatusProps> = ({ apiClient }) => {
  const [health, setHealth] = React.useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.checkHealth();
      setHealth(res);
    } catch (err: any) {
      setError(err.message || "Failed to reach API server.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div style={{ padding: "12px", border: "1px solid #333", borderRadius: "8px", background: "#1e1e1e", marginBottom: "16px" }}>
      <h4 style={{ margin: "0 0 8px 0" }}>API System Status</h4>
      {loading && <p style={{ color: "#aaa" }}>Checking backend connection...</p>}
      {error && (
        <div style={{ color: "#ff6b6b", fontSize: "14px", margin: "8px 0" }}>
          <p style={{ margin: 0, fontWeight: "bold" }}>Backend unreachable or returning error:</p>
          <p style={{ margin: "4px 0" }}>{error}</p>
          <p style={{ margin: "4px 0", color: "#ffd8a8", fontSize: "12px" }}>
            💡 Tip: Ensure API server is running (`pnpm --filter @project-inferno/api run dev`).
          </p>
        </div>
      )}
      {health && (
        <div style={{ fontSize: "14px" }}>
          <p style={{ margin: "4px 0" }}>Status: <strong style={{ color: health.status === "ok" ? "#51cf66" : "#ff6b6b" }}>{health.status.toUpperCase()}</strong></p>
          <p style={{ margin: "4px 0" }}>
            Database: <span style={{ color: health.database === "connected" ? "#51cf66" : "#ff6b6b", fontWeight: "bold" }}>{health.database}</span>
          </p>
          {health.database === "disconnected" && (
            <p style={{ margin: "4px 0", color: "#ffd8a8", fontSize: "12px" }}>
              ⚠️ Database offline: Check PostgreSQL container (`docker compose up -d`) or `DATABASE_URL`.
            </p>
          )}
          <p style={{ margin: "4px 0" }}>Version: <span>{health.version}</span></p>
        </div>
      )}
      <button onClick={checkHealth} style={{ marginTop: "8px", padding: "6px 12px", background: "#339af0", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>
        Refresh Status
      </button>
    </div>
  );
};
