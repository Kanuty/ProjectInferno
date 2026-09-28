// Error Codes
export enum ErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  INVALID_INPUT = "INVALID_INPUT",
  INSUFFICIENT_QUANTITY = "INSUFFICIENT_QUANTITY",
  INVALID_TARGET = "INVALID_TARGET",
  ACTION_NOT_ALLOWED = "ACTION_NOT_ALLOWED",
  WORLD_MISMATCH = "WORLD_MISMATCH",
  INTERNAL_ERROR = "INTERNAL_ERROR"
}

export interface ApiErrorResponse {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResponse {
  status: "ok" | "error";
  timestamp: string;
  version: string;
  database: "connected" | "disconnected";
}

// User & Auth Contracts
export interface UserDto {
  id: string;
  username: string;
  email: string;
  status: "pending_activation" | "active" | "suspended";
  createdAt: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  passwordHash: string;
  termsAccepted?: boolean;
}

export interface LoginRequest {
  login: string; // Accepts username or email address
  passwordHash: string;
}

export interface CheckUsernameResponse {
  available: boolean;
  message: string;
}

export interface ActivateAccountRequest {
  token: string;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
  message?: string;
}

// World & Game Domain Contracts
export interface WorldDto {
  id: string;
  name: string;
  status: "active" | "archived" | "maintenance";
  createdAt: string;
}

export interface PlayerBaseDto {
  id: string;
  worldId: string;
  userId: string;
  name: string;
  positionX: number;
  positionY: number;
  resources: {
    amountAtReference: number;
    productionRate: number;
    referenceAt: string;
    capacity: number;
  };
  createdAt: string;
}

export interface CreateGameEventRequest {
  worldId: string;
  eventType: string;
  executeAt: string;
  payload: Record<string, unknown>;
}

export interface GameEventDto {
  id: string;
  worldId: string;
  eventType: string;
  status: "PENDING" | "CLAIMED" | "COMPLETED" | "FAILED" | "CANCELLED";
  executeAt: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
