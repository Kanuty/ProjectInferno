import {
  HealthCheckResponse,
  UserDto,
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  CheckUsernameResponse,
  ActivateAccountRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  AdminCreateUserRequest,
  AdminBlockUserRequest,
  EmailLogDto,
  WorldDto,
  CreateWorldRequest,
  UpdateWorldStatusRequest,
  UpdateWorldDetailsRequest,
  WorldLogDto,
  BaseDto,
  MapChunkDto,
  MapOverviewDto,
  WorldPreviewResponse,
  JoinWorldRequest,
  JoinWorldResponse,
  BaseBuildingDto,
  ResourceType,
  ResourceStorageDto,
  UpgradeBuildingResponse,
  BuildingTypeId,
} from "@project-inferno/contracts";

export interface ApiClientConfig {
  baseUrl: string;
  token?: string | null;
  getToken?: () => string | null;
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private getToken?: () => string | null;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token = config.token || null;
    this.getToken = config.getToken;
  }

  public setAuthToken(token: string | null): void {
    this.token = token;
  }

  public getAuthToken(): string | null {
    if (this.getToken) {
      const dynamicToken = this.getToken();
      if (dynamicToken) return dynamicToken;
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const token = this.getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }

    return data as T;
  }

  public async getHealth(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>("/health");
  }

  public async checkUsername(username: string): Promise<CheckUsernameResponse> {
    return this.request<CheckUsernameResponse>(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
  }

  public async register(req: RegisterRequest): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(req),
    });
    if (res.token) {
      this.setAuthToken(res.token);
    }
    return res;
  }

  public async activate(req: ActivateAccountRequest): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>("/api/auth/activate", {
      method: "POST",
      body: JSON.stringify(req),
    });
    if (res.token) {
      this.setAuthToken(res.token);
    }
    return res;
  }

  public async login(req: LoginRequest): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(req),
    });
    if (res.token) {
      this.setAuthToken(res.token);
    }
    return res;
  }

  public async getMe(): Promise<UserDto> {
    return this.request<UserDto>("/api/users/me");
  }

  public async forgotPassword(req: ForgotPasswordRequest): Promise<{ message: string }> {
    return this.request<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  public async resetPassword(req: ResetPasswordRequest): Promise<{ message: string }> {
    return this.request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  // Admin User Endpoints
  public async adminGetUsers(): Promise<UserDto[]> {
    return this.request<UserDto[]>("/api/admin/users");
  }

  public async adminCreateUser(req: AdminCreateUserRequest): Promise<UserDto> {
    return this.request<UserDto>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  public async adminBlockUser(userId: string, req: AdminBlockUserRequest): Promise<UserDto> {
    return this.request<UserDto>(`/api/admin/users/${userId}/block`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  public async adminDeleteUser(userId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
  }

  public async adminGetEmailLogs(): Promise<EmailLogDto[]> {
    return this.request<EmailLogDto[]>("/api/admin/email-logs");
  }

  // Admin World & Map Tool Endpoints
  public async adminPreviewWorldGeneration(req: { mapConfig?: Record<string, unknown> }): Promise<WorldPreviewResponse> {
    return this.request<WorldPreviewResponse>("/api/admin/worlds/preview-generation", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  public async adminCreateWorld(req: CreateWorldRequest): Promise<WorldDto> {
    return this.request<WorldDto>("/api/admin/worlds", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  public async adminUpdateWorldDetails(worldId: string, req: UpdateWorldDetailsRequest): Promise<WorldDto> {
    return this.request<WorldDto>(`/api/admin/worlds/${worldId}`, {
      method: "PATCH",
      body: JSON.stringify(req),
    });
  }

  public async adminUpdateWorldStatus(worldId: string, req: UpdateWorldStatusRequest): Promise<WorldDto> {
    return this.request<WorldDto>(`/api/admin/worlds/${worldId}/status`, {
      method: "PATCH",
      body: JSON.stringify(req),
    });
  }

  public async adminDeleteWorld(worldId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/admin/worlds/${worldId}`, {
      method: "DELETE",
    });
  }

  public async adminGetWorldLogs(worldId?: string): Promise<WorldLogDto[]> {
    const queryStr = worldId ? `?worldId=${encodeURIComponent(worldId)}` : "";
    return this.request<WorldLogDto[]>(`/api/admin/world-logs${queryStr}`);
  }

  // World & Map Gameplay Endpoints
  public async getWorlds(): Promise<WorldDto[]> {
    return this.request<WorldDto[]>("/api/worlds");
  }

  public async reserveWorldSlot(worldId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/worlds/${worldId}/reserve`, {
      method: "POST",
    });
  }

  public async cancelWorldReservation(worldId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/worlds/${worldId}/reserve`, {
      method: "DELETE",
    });
  }

  public async joinWorld(worldId: string, req: JoinWorldRequest = {}): Promise<JoinWorldResponse> {
    return this.request<JoinWorldResponse>(`/api/worlds/${worldId}/join`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  public async getMapChunks(worldId: string, qMin: number, qMax: number, rMin: number, rMax: number): Promise<MapChunkDto> {
    return this.request<MapChunkDto>(`/api/worlds/${worldId}/map/chunks?qMin=${qMin}&qMax=${qMax}&rMin=${rMin}&rMax=${rMax}`);
  }

  public async getMapOverview(worldId: string): Promise<MapOverviewDto> {
    return this.request<MapOverviewDto>(`/api/worlds/${worldId}/map/overview`);
  }

  public async getWorldBases(worldId: string): Promise<BaseDto[]> {
    return this.request<BaseDto[]>(`/api/worlds/${worldId}/bases`);
  }

  // Base Village Buildings & Resources Endpoints
  public async getBaseBuildings(baseId: string): Promise<BaseBuildingDto[]> {
    return this.request<BaseBuildingDto[]>(`/api/bases/${baseId}/buildings`);
  }

  public async getBaseResources(baseId: string): Promise<Record<ResourceType, ResourceStorageDto>> {
    return this.request<Record<ResourceType, ResourceStorageDto>>(`/api/bases/${baseId}/resources`);
  }

  public async upgradeBuilding(baseId: string, buildingType: BuildingTypeId): Promise<UpgradeBuildingResponse> {
    return this.request<UpgradeBuildingResponse>(`/api/bases/${baseId}/buildings/${buildingType}/upgrade`, {
      method: "POST",
    });
  }
}
