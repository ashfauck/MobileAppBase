/**
 * The single axios instance for the app.
 *
 * Responsibilities:
 *   1. Base URL + timeout from the compiled-in environment.
 *   2. Attach the access token to every request.
 *   3. Refresh the token exactly once on a 401 and replay the queued requests.
 *   4. Normalize every failure into ApiError.
 *
 * The refresh logic is the subtle part. If five requests fire concurrently and
 * all get a 401, a naive implementation performs five refreshes — which on most
 * backends invalidates the previous refresh token four times and logs the user
 * out. We therefore keep a single in-flight refresh promise and queue everyone
 * else behind it.
 */
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env } from '../../config/env';
import { secureStorage, type AuthTokens } from '../storage/secureStorage';
import { ApiError, normalizeError } from './errors';

/** Marks a request we've already retried, so a second 401 logs out instead of looping. */
type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean; _skipAuth?: boolean };

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.api.baseUrl,
  timeout: env.api.timeoutMs,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/* ------------------------------------------------------------- refreshing ---
 * `refreshPromise` is non-null only while a refresh is in flight. Everyone who
 * 401s during that window awaits the same promise.
 */
let refreshPromise: Promise<AuthTokens | null> | null = null;

/** Called when refresh fails — wired up in src/app/AppProviders to avoid a
 *  circular import between the client and the auth store. */
let onAuthFailure: (() => void) | null = null;

export function setAuthFailureHandler(handler: () => void): void {
  onAuthFailure = handler;
}

async function performRefresh(): Promise<AuthTokens | null> {
  const tokens = await secureStorage.getTokens();
  if (!tokens?.refreshToken) return null;

  try {
    // A bare axios call, NOT apiClient — using the instance here would recurse
    // through this same interceptor on failure.
    const response = await axios.post<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>(
      '/auth/refresh',
      { refreshToken: tokens.refreshToken },
      { baseURL: env.api.baseUrl, timeout: env.api.timeoutMs },
    );

    const next: AuthTokens = {
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      expiresAt: Date.now() + response.data.expiresIn * 1000,
    };

    await secureStorage.saveTokens(next);
    return next;
  } catch {
    await secureStorage.clearTokens();
    return null;
  }
}

function refreshTokens(): Promise<AuthTokens | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      // Clear only after the promise settles so late arrivals still join it.
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/* ------------------------------------------------------ request pipeline --- */

apiClient.interceptors.request.use(
  async (config: RetriableConfig) => {
    if (config._skipAuth) return config;

    const tokens = await secureStorage.getTokens();
    if (tokens?.accessToken) {
      config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
    }

    if (env.isDev && env.logLevel === 'debug') {
      console.info(`[api] → ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => Promise.reject(normalizeError(error)),
);

/* ----------------------------------------------------- response pipeline --- */

apiClient.interceptors.response.use(
  (response) => {
    if (env.isDev && env.logLevel === 'debug') {
      console.info(`[api] ← ${response.status} ${response.config.url}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    const shouldAttemptRefresh =
      status === 401 && config !== undefined && !config._retried && !config._skipAuth;

    if (!shouldAttemptRefresh) {
      return Promise.reject(normalizeError(error));
    }

    config._retried = true;

    const tokens = await refreshTokens();

    if (!tokens) {
      // Refresh failed: the session is genuinely dead.
      onAuthFailure?.();
      return Promise.reject(
        new ApiError({
          kind: 'unauthorized',
          message: 'Session expired',
          status: 401,
          cause: error,
        }),
      );
    }

    config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
    return apiClient(config);
  },
);

/* ------------------------------------------------------------- convenience --- */

/**
 * Thin typed wrappers. Using these instead of apiClient directly means call
 * sites deal in plain data and ApiError, never AxiosResponse.
 */
export const api = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await apiClient.get<T>(url, config);
    return response.data;
  },

  async post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await apiClient.post<T>(url, body, config);
    return response.data;
  },

  async put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await apiClient.put<T>(url, body, config);
    return response.data;
  },

  async patch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await apiClient.patch<T>(url, body, config);
    return response.data;
  },

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await apiClient.delete<T>(url, config);
    return response.data;
  },
};

/** Exposed for tests, which need to clear state between cases. */
export function __resetRefreshStateForTests(): void {
  refreshPromise = null;
}
