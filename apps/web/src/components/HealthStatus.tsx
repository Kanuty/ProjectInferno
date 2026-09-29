import React, { useState, useEffect } from "react";
import { HealthCheckResponse } from "@project-inferno/contracts";
import { ApiClient } from "@project-inferno/api-client";

interface HealthStatusProps {
  apiClient: ApiClient;
}

export const HealthStatus: React.FC<HealthStatusProps> = ({ apiClient }) => {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getHealth()
      .then(setHealth)
      .catch((err) => setError(err.message || "Failed to connect to API"));
  }, [apiClient]);

  if (error) {
    return <div style={{ padding: "8px 12px", background: "#7f1d1d", color: "#fca5a5", borderRadius: "6px", fontSize: "12px", marginBottom: "12px" }}>API Health Status: Disconnected ({error})</div>;
  }

  if (!health) {
    return <div style={{ padding: "8px 12px", background: "#27272a", color: "#a1a1aa", borderRadius: "6px", fontSize: "12px", marginBottom: "12px" }}>Checking system status...</div>;
  }

  return (
    <div style={{ padding: "8px 12px", background: "#113827", color: "#86efac", borderRadius: "6px", fontSize: "12px", marginBottom: "12px", display: "flex", gap: "16px" }}>
      <span>System Status: <strong>{health.status.toUpperCase()}</strong></span>
      <span>Database: <strong>{health.database}</strong></span>
      <span>API Version: <strong>{health.version}</strong></span>
    </div>
  );
};
