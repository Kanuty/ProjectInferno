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
  email?: string | null;
  status: "pending_activation" | "active" | "suspended";
  role?: "super_admin" | "admin" | "tester" | "user";
  createdAt: string;
}

export interface AdminCreateUserRequest {
  username: string;
  passwordHash: string;
  email?: string;
  role?: "super_admin" | "admin" | "tester" | "user";
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPasswordHash: string;
}

export interface AdminBlockUserRequest {
  status: "active" | "suspended";
}

export interface EmailLogDto {
  id: string;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  status: string;
  sentAt: string;
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
export type WorldStageStatus =
  | "planned_open"
  | "planned_closed"
  | "active"
  | "active_closed"
  | "suspended"
  | "archived";

export interface WorldDto {
  id: string;
  name: string;
  status: WorldStageStatus;
  startsAt?: string | null;
  maxPlayers?: number;
  isTestOnly?: boolean;
  autoCloseDays?: number;
  reservedCount?: number;
  isReservedByMe?: boolean;
  createdAt: string;
}

export interface CreateWorldRequest {
  name: string;
  startsAt?: string;
  maxPlayers?: number;
  isTestOnly?: boolean;
  autoCloseDays?: number;
  status?: WorldStageStatus;
}

export interface UpdateWorldStatusRequest {
  status: WorldStageStatus;
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
