// API requests go through Next.js proxy (next.config.js rewrites /api/v1 → backend)
export const API_BASE_URL = '/api/v1';

// EventSource (SSE) does NOT go through Next.js proxy, so must hit backend directly
export const STREAM_BASE_URL = 'http://localhost:8000/api/v1';

// ── Types ────────────────────────────────────────────────────

export interface ProcessResponse {
  status: string;
  message: string;
  task_id?: string;
  filepath?: string;
}

export interface ProcessingLog {
  id: number;
  timestamp: string;
  filepath: string;
  po_number: string;
  status: string;
  error_message: string | null;
  confidence_score: number | null;
  processing_time_seconds: number | null;
  metadata_json: string | null;
  owner_id: number | null;
  uploader_name?: string;
}

export interface Stats {
  total: number;
  successful: number;
  failed: number;
  avg_time: number;
}

export interface User {
  id: number;
  username: string;
  email?: string;
  role: 'Admin' | 'Operator';
  created_at?: string;
  access_token?: string; // JWT returned from server
}

export interface UserUpdate {
  email?: string;
  role?: string;
  password?: string;
}

// ── Helpers ──────────────────────────────────────────────────

const getAuthHeaders = (user: User): Record<string, string> => ({
  'Authorization': `Bearer ${user.access_token}`,
});

async function handleResponse<T>(res: Response): Promise<T> {
  console.log(`API Response from ${res.url}:`, res.status);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

// ── API Client ───────────────────────────────────────────────

export const api = {
  // Auth
  async login(username: string, password: string): Promise<{ status: string; user: User; access_token: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await handleResponse<{ status: string; user: User; access_token: string }>(res);
    // Attach token to user object for easy pass-around
    data.user.access_token = data.access_token;
    return data;
  },

  async signup(username: string, password: string, email?: string, role: string = 'Operator'): Promise<{ status: string; user: User; access_token: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email, role }),
    });
    const data = await handleResponse<{ status: string; user: User; access_token: string }>(res);
    data.user.access_token = data.access_token;
    return data;
  },

  // Stats & Logs
  async getStats(user: User): Promise<Stats> {
    const res = await fetch(`${API_BASE_URL}/history/stats`, {
      headers: getAuthHeaders(user),
    });
    return handleResponse(res);
  },

  async getLogs(user: User, limit: number = 50): Promise<ProcessingLog[]> {
    const res = await fetch(`${API_BASE_URL}/history/logs?limit=${limit}`, {
      headers: getAuthHeaders(user),
    });
    return handleResponse(res);
  },

  async deleteLog(id: number, user: User): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE_URL}/history/logs/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(user),
    });
    return handleResponse(res);
  },

  // Invoice Processing
  async uploadForStreaming(file: File, user: User): Promise<ProcessResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE_URL}/invoices/upload`, {
      method: 'POST',
      headers: getAuthHeaders(user),
      body: formData,
    });
    return handleResponse(res);
  },

  streamProcessing(taskId: string, user: User): EventSource {
    const params = new URLSearchParams({
      token: user.access_token || '',
    });
    return new EventSource(`${STREAM_BASE_URL}/invoices/stream/${taskId}?${params}`);
  },

  globalStream(user: User): EventSource {
    const params = new URLSearchParams({
      token: user.access_token || '',
    });
    return new EventSource(`${STREAM_BASE_URL}/invoices/stream/global?${params}`);
  },

  // User Management (Admin)
  async getUsers(user: User): Promise<{ users: User[]; total: number }> {
    const url = `${API_BASE_URL}/users`;
    const res = await fetch(url, {
      headers: getAuthHeaders(user),
    });
    return handleResponse(res);
  },

  async createUser(data: any, user: User): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders(user) },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateUser(userId: number, update: UserUpdate, user: User): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders(user) },
      body: JSON.stringify(update),
    });
    return handleResponse(res);
  },

  async deleteUser(userId: number, user: User): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(user),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to delete user');
    }
  },
};
