import React, { useState, useEffect, useRef } from "react";
import { BaseDto, CosmeticFeatureDto, MapOverviewDto, WorldDto } from "@project-inferno/contracts";
import { ApiClient } from "@project-inferno/api-client";
import { getRaceDefinition } from "@project-inferno/game-core";

interface HexMapViewProps {
  apiClient: ApiClient;
  world: WorldDto;
  currentUserId: string;
  onSelectBase?: (base: BaseDto) => void;
  onOpenVillageView?: (base: BaseDto) => void;
}

export const HexMapView: React.FC<HexMapViewProps> = ({
  apiClient,
  world,
  currentUserId,
  onSelectBase,
  onOpenVillageView,
}) => {
  const [settlements, setSettlements] = useState<BaseDto[]>([]);
  const [terrainFeatures, setTerrainFeatures] = useState<CosmeticFeatureDto[]>([]);
  const [overview, setOverview] = useState<MapOverviewDto | null>(null);
  const [activeBase, setActiveBase] = useState<BaseDto | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<BaseDto | null>(null);

  // Viewport center axial q, r and zoom
  const [viewQ, setViewQ] = useState(0);
  const [viewR, setViewR] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [minimapZoom, setMinimapZoom] = useState(1.0);

  // Mouse / Touch Panning State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
      const qMin = Math.max(-radius, viewQ - 10);
      const qMax = Math.min(radius, viewQ + 10);
      const rMin = Math.max(-radius, viewR - 10);
      const rMax = Math.min(radius, viewR + 10);

      const [chunkData, overviewData] = await Promise.all([
        apiClient.getMapChunks(world.id, qMin, qMax, rMin, rMax),
        apiClient.getMapOverview(world.id),
      ]);

      setSettlements(chunkData.settlements);
      setTerrainFeatures(chunkData.terrainFeatures || []);
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

  // Mouse & Touch Drag Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    const hexRadius = Math.max(8, 36 * zoom);
    const sensitivity = hexRadius * 1.5;

    if (Math.abs(dx) > sensitivity || Math.abs(dy) > sensitivity) {
      const dq = Math.round(-dx / sensitivity);
      const dr = Math.round(-dy / sensitivity);

      const radius = world.config?.radius || 15;
      setViewQ((prevQ) => Math.max(-radius, Math.min(radius, prevQ + dq)));
      setViewR((prevR) => Math.max(-radius, Math.min(radius, prevR + dr)));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Render Main Map Canvas with True Hex Geometry and Cosmetic Terrain
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
    const hexRadius = Math.max(10, 36 * zoom);
    const worldRadius = world.config?.radius || 15;

    // Render Hex Grid cells in radial distance bounds
    const range = 8;
    for (let q = viewQ - range; q <= viewQ + range; q++) {
      for (let r = viewR - range; r <= viewR + range; r++) {
        // Enforce true hex boundary check
        if (hexDistance(0, 0, q, r) > worldRadius) continue;

        // Proper Pointy-Topped Hex Axial to Pixel Math
        const x = centerX + hexRadius * (Math.sqrt(3) * (q - viewQ) + (Math.sqrt(3) / 2) * (r - viewR));
        const y = centerY + hexRadius * ((3 / 2) * (r - viewR));

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
        if (zoom >= 0.85) {
          ctx.fillStyle = "#475569";
          ctx.font = "10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${q},${r}`, x, y + hexRadius * 0.6);
        }
      }
    }

    // Render Cosmetic Terrain Features
    for (const feature of terrainFeatures) {
      if (hexDistance(0, 0, feature.q, feature.r) > worldRadius) continue;
      const x = centerX + hexRadius * (Math.sqrt(3) * (feature.q - viewQ) + (Math.sqrt(3) / 2) * (feature.r - viewR));
      const y = centerY + hexRadius * ((3 / 2) * (feature.r - viewR));

      ctx.textAlign = "center";
      ctx.font = `${Math.max(12, hexRadius * 0.7)}px sans-serif`;
      if (feature.type === "TREE") {
        ctx.fillStyle = "#22c55e";
        ctx.fillText("🌲", x, y + 4);
      } else if (feature.type === "ROCK") {
        ctx.fillStyle = "#64748b";
        ctx.fillText("🪨", x, y + 4);
      } else if (feature.type === "LAKE") {
        ctx.fillStyle = "#38bdf8";
        ctx.fillText("🌊", x, y + 4);
      } else if (feature.type === "MOUNTAIN") {
        ctx.fillStyle = "#a855f7";
        ctx.fillText("🏔️", x, y + 4);
      }
    }

    // Render Settlements (Bases) without text clutter above tokens
    for (const base of settlements) {
      if (typeof base?.q !== "number" || typeof base?.r !== "number") continue;
      if (hexDistance(0, 0, base.q, base.r) > worldRadius) continue;

      const x = centerX + hexRadius * (Math.sqrt(3) * (base.q - viewQ) + (Math.sqrt(3) / 2) * (base.r - viewR));
      const y = centerY + hexRadius * ((3 / 2) * (base.r - viewR));

      if (isNaN(x) || isNaN(y)) continue;

      const isOwn = base.userId === currentUserId;
      const isActive = activeBase?.id === base.id;
      const isNeutral = !base.userId;

      const raceDef = getRaceDefinition(base.tintRaceId);

      // Base Icon Circle Token with Race Color & Icon
      ctx.beginPath();
      ctx.arc(x, y, hexRadius * 0.48, 0, 2 * Math.PI);

      if (isOwn) {
        ctx.fillStyle = isActive ? "#38bdf8" : raceDef.ecology.primaryColor;
      } else if (isNeutral) {
        ctx.fillStyle = "#eab308"; // Yellow dirt/rock neutral base (Wearebears)
      } else {
        ctx.fillStyle = raceDef.ecology.primaryColor || "#ef4444"; // Hostile Player Base
      }
      ctx.fill();

      ctx.strokeStyle = isActive ? "#ffffff" : isOwn ? "#38bdf8" : "#0f172a";
      ctx.lineWidth = isActive ? 3 : 1.5;
      ctx.stroke();

      // Render Race Icon Emoji inside settlement token
      ctx.textAlign = "center";
      ctx.font = `${Math.max(10, hexRadius * 0.5)}px sans-serif`;
      ctx.fillText(raceDef.icon, x, y + hexRadius * 0.18);
    }
  }, [settlements, terrainFeatures, viewQ, viewR, zoom, activeBase, currentUserId, world]);

  // Render Minimap Canvas Overview with Zoom Controls
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

    const r = Math.max(1, overview.radius || 15);
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.max(0.5, (Math.min(width, height) / (2 * r + 2)) * minimapZoom);

    // Draw world radial boundary
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, r * scale * 1.5, 0, 2 * Math.PI);
    ctx.stroke();

    // Render settlements on minimap
    if (Array.isArray(overview.settlements)) {
      for (const item of overview.settlements) {
        if (typeof item?.q !== "number" || typeof item?.r !== "number") continue;
        const x = centerX + scale * (Math.sqrt(3) * item.q + (Math.sqrt(3) / 2) * item.r);
        const y = centerY + scale * ((3 / 2) * item.r);

        if (isNaN(x) || isNaN(y)) continue;

        ctx.fillStyle = item.userId === currentUserId ? "#38bdf8" : item.isNeutral ? "#eab308" : "#ef4444";
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.5, scale * 0.4), 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Render current viewport box on minimap
    const vx = centerX + scale * (Math.sqrt(3) * viewQ + (Math.sqrt(3) / 2) * viewR);
    const vy = centerY + scale * ((3 / 2) * viewR);
    if (!isNaN(vx) && !isNaN(vy)) {
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.strokeRect(vx - 14, vy - 12, 28, 24);
    }
  }, [overview, viewQ, viewR, currentUserId, minimapZoom]);

  // Canvas Click Handler for Settlement Selection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const hexRadius = Math.max(10, 36 * zoom);

    let closest: BaseDto | null = null;
    let minDistance = Infinity;

    for (const base of settlements) {
      if (typeof base?.q !== "number" || typeof base?.r !== "number") continue;
      const x = centerX + hexRadius * (Math.sqrt(3) * (base.q - viewQ) + (Math.sqrt(3) / 2) * (base.r - viewR));
      const y = centerY + hexRadius * ((3 / 2) * (base.r - viewR));
      const dist = Math.hypot(clickX - x, clickY - y);
      if (dist < hexRadius * 0.65 && dist < minDistance) {
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
          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Center: ({viewQ}, {viewR}) | Drag mouse/finger to pan</span>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
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
          width={880}
          height={540}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleCanvasClick}
          style={{ width: "100%", height: "100%", cursor: isDragging ? "grabbing" : "grab", display: "block" }}
        />

        {/* Larger Minimap Overlay in Bottom Right with Zoom Controls */}
        <div style={{ position: "absolute", bottom: "16px", right: "16px", backgroundColor: "rgba(15, 23, 42, 0.95)", border: "1px solid #334155", borderRadius: "8px", padding: "10px", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: "bold" }}>Minimap</span>
            <div style={{ display: "flex", gap: "4px" }}>
              <button onClick={() => setMinimapZoom((z) => Math.min(2.5, z + 0.25))} style={miniBtnStyle}>+</button>
              <button onClick={() => setMinimapZoom((z) => Math.max(0.5, z - 0.25))} style={miniBtnStyle}>-</button>
            </div>
          </div>
          <canvas ref={minimapCanvasRef} width={220} height={220} style={{ display: "block", borderRadius: "4px" }} />
        </div>

        {/* Interactive Settlement Pop-up Card */}
        {selectedSettlement && (
          <div style={{ position: "absolute", top: "16px", left: "16px", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "10px", padding: "16px", width: "280px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", borderBottom: "1px solid #334155", paddingBottom: "6px" }}>
              <h4 style={{ margin: 0, color: "#f97316", fontSize: "1.05rem" }}>{selectedSettlement.name}</h4>
              <button onClick={() => setSelectedSettlement(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.2rem" }}>&times;</button>
            </div>

            {(() => {
              const selRaceDef = getRaceDefinition(selectedSettlement.tintRaceId);
              return (
                <div style={{ fontSize: "0.85rem", color: "#cbd5e1", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div>Owner Player: <strong style={{ color: "#38bdf8" }}>{selectedSettlement.ownerUsername || "Neutral / Abandoned"}</strong></div>
                  <div>Village Name: <strong>{selectedSettlement.name}</strong></div>
                  <div>
                    Race / Faction: <strong style={{ color: selRaceDef.ecology.primaryColor }}>{selRaceDef.icon} {selRaceDef.name}</strong>
                  </div>
                  <div>Ecology: <em>{selRaceDef.ecology.terrainType}</em></div>
                  <div>Village Points: <strong>{selectedSettlement.points || 100}</strong></div>
                  <div>Coordinates: <strong>({selectedSettlement.q}, {selectedSettlement.r})</strong></div>
                  {activeBase && (
                    <div>
                      Distance: <strong>
                        {hexDistance(activeBase.q, activeBase.r, selectedSettlement.q, selectedSettlement.r)} hexes
                      </strong>
                    </div>
                  )}
                </div>
              );
            })()}

            {selectedSettlement.userId === currentUserId ? (
              <button
                onClick={() => {
                  if (onOpenVillageView) onOpenVillageView(selectedSettlement);
                }}
                style={{ ...actionBtnStyle, backgroundColor: "#0284c7", width: "100%", marginTop: "14px" }}
              >
                Enter Village View
              </button>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "14px" }}>
                <button style={actionBtnStyle}>Attack</button>
                <button style={actionBtnStyle}>Send Trade</button>
              </div>
            )}
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

const miniBtnStyle: React.CSSProperties = {
  padding: "2px 6px",
  backgroundColor: "#334155",
  color: "#f8fafc",
  border: "none",
  borderRadius: "3px",
  fontSize: "0.75rem",
  fontWeight: 700,
  cursor: "pointer",
};

const actionBtnStyle: React.CSSProperties = {
  padding: "8px",
  backgroundColor: "#f97316",
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
};
