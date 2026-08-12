/**
 * Auth endpoints.
 *
 * The template has no backend, so `login` falls back to a mock when the API is
 * unreachable and the build is non-production. Delete `mockLogin` and the
 * fallback in `login` as soon as you point API_URL at a real server.
 */
import { api } from '../../../services/api/client';
import { env } from '../../../config/env';
import { ApiError } from '../../../services/api/errors';
import type { AuthTokens } from '../../../services/storage/secureStorage';
import type { User } from '../store/authStore';

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
};

function toTokens(response: LoginResponse): AuthTokens {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    expiresAt: Date.now() + response.expiresIn * 1000,
  };
}

/* ------------------------------------------------------------------ mock --- */

function mockLogin(request: LoginRequest): { user: User; tokens: AuthTokens } {
  const name = request.email.split('@')[0] ?? 'there';

  return {
    user: {
      id: 'demo-user-1',
      email: request.email,
      name: name.charAt(0).toUpperCase() + name.slice(1),
    },
    tokens: {
      accessToken: 'demo-access-token',
      refreshToken: 'demo-refresh-token',
      expiresAt: Date.now() + 60 * 60 * 1000,
    },
  };
}

/* ------------------------------------------------------------ endpoints --- */

export const authApi = {
  async login(request: LoginRequest): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const response = await api.post<LoginResponse>('/auth/login', request);
      return { user: response.user, tokens: toTokens(response) };
    } catch (error) {
      // In dev/staging with no backend running, fall through to the mock so the
      // template is usable out of the box. Real credential errors (401/422)
      // still surface, so the error path stays testable.
      const isUnreachable =
        error instanceof ApiError && (error.kind === 'network' || error.kind === 'timeout');

      if (isUnreachable && !env.isProd) {
        console.warn('[auth] API unreachable — using mock login. Remove this before shipping.');
        return mockLogin(request);
      }

      throw error;
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      // A failed logout call must never block the local sign-out; the tokens
      // are cleared regardless.
    }
  },

  async me(): Promise<User> {
    return api.get<User>('/auth/me');
  },

  async requestPasswordReset(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email });
  },
};
