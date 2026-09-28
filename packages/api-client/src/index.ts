import {
  AuthResponse,
  HealthCheckResponse,
  LoginRequest,
  PlayerBaseDto,
  RegisterRequest,
  UserDto,
  WorldDto,
  CreateGameEventRequest,
  GameEventDto,
  ApiErrorResponse,
  ErrorCode
} from "@project-inferno/contracts";

export class ApiClientError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export class InfernoApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = "http://localhost:3000") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  setAuthToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
      });
    } catch (networkErr: any) {
      throw new ApiClientError(
        ErrorCode.INTERNAL_ERROR,
        `Network request failed: Could not connect to API server at ${this.baseUrl}. (${networkErr.message || "Connection refused"})`
      );
    }

    if (!response.ok) {
      let errorData: ApiErrorResponse;
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          code: ErrorCode.INTERNAL_ERROR,
          message: `HTTP Error ${response.status}: ${response.statusText}`,
        };
      }
      throw new ApiClientError(errorData.code, errorData.message, errorData.details);
    }

    return (await response.json()) as T;
  }

  async checkHealth(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>("/health");
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    this.setAuthToken(res.token);
    return res;
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    this.setAuthToken(res.token);
    return res;
  }

  async getMe(): Promise<UserDto> {
    return this.request<UserDto>("/api/users/me");
  }

  async getWorlds(): Promise<WorldDto[]> {
    return this.request<WorldDto[]>("/api/worlds");
  }

  async getPlayerBases(worldId: string): Promise<PlayerBaseDto[]> {
    return this.request<PlayerBaseDto[]>(`/api/worlds/${worldId}/bases`);
  }

  async scheduleEvent(data: CreateGameEventRequest): Promise<GameEventDto> {
    return this.request<GameEventDto>("/api/events", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}
