import React, { useState, useEffect, useRef } from "react";
import { BaseDto, MapOverviewDto, WorldDto } from "@project-inferno/contracts";
import { ApiClient } from "@project-inferno/api-client";

interface HexMapViewProps {
  apiClient: ApiClient;
  world: WorldDto;
  currentUserId: string;
  onSelectBase?: (base: BaseDto) => void;
}

export const HexMapView: React.FC<HexMapViewProps> = ({
  apiClient,
  world,
  currentUserId,
  onSelectBase,
}) => {
  const [settlements, setSettlements] = useState<BaseDto[]>([]);
  const [overview, setOverview] = useState<MapOverviewDto | null>(null);
  const [activeBase, setActiveBase] = useState<BaseDto | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<BaseDto | null>(null);

  // Viewport center axial q, r and zoom
  const [viewQ, setViewQ] = useState(0);
  const [viewR, setViewR] = useState(0);
  const [zoom, setZoom] = useState(1.0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Hex axial distance helper
  const hexDistance = (q1: number, r1: number, q2: number, r2: number) => {
    return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - (q2 + r2))) / 2;
  };

  // Fetch Chunk Settlements and Overview
  const fetchMapData = async () => {
    try {
      const radius = world.config?.radius || 15;
      const qMin = Math.max(-radius, viewQ - 6);
      const qMax = Math.min(radius, viewQ + 6);
      const rMin = Math.max(-radius, viewR - 6);
      const rMax = Math.min(radius, viewR + 6);

      const [chunkData, overviewData] = await Promise.all([
        apiClient.getMapChunks(world.id, qMin, qMax, rMin, rMax),
        apiClient.getMapOverview(world.id),
      ]);

      setSettlements(chunkData.settlements);
      setOverview(overviewData);

      // Find own base for active base marker
      const ownBase = chunkData.settlements.find((s) => s.userId === currentUserId);
      if (ownBase && !activeBase) {
        setActiveBase(ownBase);
      }
    } catch (err) {
      console.error("Failed to load map chunk data:", err);
    }
  };

  useEffect(() => {
    fetchMapData();
  }, [world.id, viewQ, viewR]);

  // Center on active base
  const handleCenterOnActiveBase = () => {
    if (activeBase) {
      setViewQ(activeBase.q);
      setViewR(activeBase.r);
    }
  };

  // Render Main Map Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const hexRadius = 32 * zoom;

    // Render Hex Grid cells around viewport
    const range = 6;
    for (let q = viewQ - range; q <= viewQ + range; q++) {
      for (let r = viewR - range; r <= viewR + range; r++) {
        const x = centerX + (q - viewQ + (r - viewR) / 2) * hexRadius * 1.732;
        const y = centerY + (r - viewR) * hexRadius * 1.5;

        // Draw Hexagon Cell
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 180) * (60 * i - 30);
          const hx = x + hexRadius * Math.cos(angle);
          const hy = y + hexRadius * Math.sin(angle);
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fillStyle = "#1e293b";
        ctx.fill();
        ctx.stroke();

        // Coordinate label
        if (zoom >= 0.8) {
          ctx.fillStyle = "#475569";
          ctx.font = "10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${q},${r}`, x, y + hexRadius * 0.7);
        }
      }
    }

    // Render Settlements (Bases)
    for (const base of settlements) {
      const x = centerX + (base.q - viewQ + (base.r - viewR) / 2) * hexRadius * 1.732;
      const y = centerY + (base.r - viewR) * hexRadius * 1.5;

      const isOwn = base.userId === currentUserId;
      const isActive = activeBase?.id === base.id;
      const isNeutral = !base.userId;

      // Base Icon Circle
      ctx.beginPath();
      ctx.arc(x, y, hexRadius * 0.45, 0, 2 * Math.PI);

      if (isOwn) {
        ctx.fillStyle = isActive ? "#38bdf8" : "#0284c7";
      } else if (isNeutral) {
        ctx.fillStyle = "#eab308"; // Yellow dirt/rock neutral base
      } else {
        ctx.fillStyle = "#ef4444"; // Enemy Player Base
      }
      ctx.fill();

      ctx.strokeStyle = isActive ? "#ffffff" : "#0f172a";
      ctx.lineWidth = isActive ? 3 : 1.5;
      ctx.stroke();

      // Label Name
      ctx.fillStyle = isOwn ? "#38bdf8" : isNeutral ? "#fef08a" : "#fca5a5";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(base.name, x, y - hexRadius * 0.55);
    }
  }, [settlements, viewQ, viewR, zoom, activeBase, currentUserId]);

  // Render Minimap Canvas Overview
  useEffect(() => {
    if (!overview || !minimapCanvasRef.current) return;
    const canvas = minimapCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const r = overview.radius;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) / (2 * r + 2);

    // Draw world border
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, r * scale, 0, 2 * Math.PI);
    ctx.stroke();

    // Render settlements
    for (const item of overview.settlements) {
      const x = centerX + (item.q + item.r / 2) * scale * 1.5;
      const y = centerY + item.r * scale * 1.3;

      ctx.fillStyle = item.userId === currentUserId ? "#38bdf8" : item.isNeutral ? "#eab308" : "#ef4444";
      ctx.beginPath();
      ctx.arc(x, y, scale * 0.4, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Render current viewport box on minimap
    const vx = centerX + (viewQ + viewR / 2) * scale * 1.5;
    const vy = centerY + viewR * scale * 1.3;
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.strokeRect(vx - 12, vy - 10, 24, 20);
  }, [overview, viewQ, viewR, currentUserId]);

  // Canvas Click Handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const hexRadius = 32 * zoom;

    let closest: BaseDto | null = null;
    let minDistance = Infinity;

    for (const base of settlements) {
      const x = centerX + (base.q - viewQ + (base.r - viewR) / 2) * hexRadius * 1.732;
      const y = centerY + (base.r - viewR) * hexRadius * 1.5;
      const dist = Math.hypot(clickX - x, clickY - y);
      if (dist < hexRadius * 0.6 && dist < minDistance) {
        minDistance = dist;
        closest = base;
      }
    }

    setSelectedSettlement(closest);
    if (closest && onSelectBase) {
      onSelectBase(closest);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#0f172a", color: "#f8fafc", borderRadius: "12px", overflow: "hidden", border: "1px solid #334155" }}>
      {/* Map Header Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", backgroundColor: "#1e293b", borderBottom: "1px solid #334155" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h3 style={{ margin: 0, color: "#f97316", fontSize: "1.1rem" }}>{world.name} (Hex Map)</h3>
          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Center: ({viewQ}, {viewR})</span>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setViewR(viewR - 1)} style={btnStyle}>↑ North</button>
          <button onClick={() => setViewR(viewR + 1)} style={btnStyle}>↓ South</button>
          <button onClick={() => setViewQ(viewQ - 1)} style={btnStyle}>← West</button>
          <button onClick={() => setViewQ(viewQ + 1)} style={btnStyle}>→ East</button>
          <button onClick={() => setZoom(Math.min(2.0, zoom + 0.2))} style={btnStyle}>Zoom +</button>
          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.2))} style={btnStyle}>Zoom -</button>
          {activeBase && (
            <button onClick={handleCenterOnActiveBase} style={{ ...btnStyle, backgroundColor: "#0284c7", color: "#ffffff" }}>
              Center Active Base
            </button>
          )}
        </div>
      </div>

      {/* Main Map Canvas & Minimap Overlay */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          onClick={handleCanvasClick}
          style={{ width: "100%", height: "100%", cursor: "crosshair", display: "block" }}
        />

        {/* Minimap Overlay in Bottom Right */}
        <div style={{ position: "absolute", bottom: "16px", right: "16px", backgroundColor: "rgba(15, 23, 42, 0.9)", border: "1px solid #334155", borderRadius: "8px", padding: "8px", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)" }}>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px", fontWeight: "bold" }}>Minimap</div>
          <canvas ref={minimapCanvasRef} width={150} height={150} style={{ display: "block", borderRadius: "4px" }} />
        </div>

        {/* Selected Settlement Context Action Card */}
        {selectedSettlement && (
          <div style={{ position: "absolute", top: "16px", left: "16px", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", padding: "14px", width: "260px", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h4 style={{ margin: 0, color: "#f8fafc" }}>{selectedSettlement.name}</h4>
              <button onClick={() => setSelectedSettlement(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>&times;</button>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#cbd5e1", display: "flex", flexDirection: "column", gap: "4px" }}>
              <div>Owner: <strong>{selectedSettlement.ownerUsername || "Neutral / Abandoned"}</strong></div>
              <div>Coordinates: <strong>({selectedSettlement.q}, {selectedSettlement.r})</strong></div>
              {activeBase && (
                <div>
                  Distance: <strong>
                    {hexDistance(activeBase.q, activeBase.r, selectedSettlement.q, selectedSettlement.r)} hexes
                  </strong>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px" }}>
              <button style={actionBtnStyle}>Attack</button>
              <button style={actionBtnStyle}>Send Trade</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: "6px 10px",
  backgroundColor: "#334155",
  color: "#f8fafc",
  border: "none",
  borderRadius: "4px",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
};

const actionBtnStyle: React.CSSProperties = {
  padding: "8px",
  backgroundColor: "#f97316",
  color: "#ffffff",
  border: "none",
  borderRadius: "4px",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
};
