/**
 * A single error shape for the whole app.
 *
 * Axios throws four structurally different things (response error, request
 * error with no response, cancellation, and plain JS errors from interceptors).
 * Letting those reach the UI means every screen writes its own defensive
 * `error?.response?.data?.message ?? ...` chain. We normalize once here.
 */
import axios, { type AxiosError } from 'axios';

export type ApiErrorKind =
  | 'network' // Device offline, DNS failure, connection refused.
  | 'timeout' // Request exceeded API_TIMEOUT_MS.
  | 'unauthorized' // 401 — token missing/expired and refresh failed.
  | 'forbidden' // 403 — authenticated but not allowed.
  | 'notFound' // 404
  | 'validation' // 422 / 400 with field errors.
  | 'rateLimited' // 429
  | 'server' // 5xx
  | 'cancelled' // Request aborted (component unmounted, query cancelled).
  | 'unknown';

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly fieldErrors?: FieldErrors;
  readonly requestId?: string;
  /** The original error, kept for Sentry — never render this. */
  readonly cause?: unknown;

  constructor(params: {
    kind: ApiErrorKind;
    message: string;
    status?: number;
    fieldErrors?: FieldErrors;
    requestId?: string;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.kind = params.kind;
    this.status = params.status;
    this.fieldErrors = params.fieldErrors;
    this.requestId = params.requestId;
    this.cause = params.cause;
  }

  /** Retrying a 4xx will fail identically; retrying a 5xx or network blip won't. */
  get isRetryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'server';
  }

  /** Safe to show a user as-is. */
  get userMessage(): string {
    switch (this.kind) {
      case 'network':
        return 'No internet connection. Check your network and try again.';
      case 'timeout':
        return 'The request took too long. Please try again.';
      case 'unauthorized':
        return 'Your session has expired. Please sign in again.';
      case 'forbidden':
        return "You don't have permission to do that.";
      case 'notFound':
        return "We couldn't find what you were looking for.";
      case 'rateLimited':
        return 'Too many requests. Please wait a moment and try again.';
      case 'server':
        return 'Something went wrong on our end. Please try again shortly.';
      case 'validation':
        // Server validation messages are written for users, so pass through.
        return this.message;
      case 'cancelled':
        return '';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
}

type ErrorBody = {
  message?: string;
  error?: string;
  errors?: FieldErrors;
};

function statusToKind(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 422 || status === 400) return 'validation';
  if (status === 429) return 'rateLimited';
  if (status >= 500) return 'server';
  return 'unknown';
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isCancel(error)) {
    return new ApiError({ kind: 'cancelled', message: 'Request cancelled', cause: error });
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ErrorBody>;

    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return new ApiError({ kind: 'timeout', message: 'Request timed out', cause: error });
    }

    // No response object at all means the request never reached the server.
    if (!axiosError.response) {
      return new ApiError({
        kind: 'network',
        message: axiosError.message || 'Network error',
        cause: error,
      });
    }

    const { status, data, headers } = axiosError.response;

    return new ApiError({
      kind: statusToKind(status),
      message: data?.message ?? data?.error ?? `Request failed with status ${status}`,
      status,
      fieldErrors: data?.errors,
      requestId: (headers?.['x-request-id'] as string | undefined) ?? undefined,
      cause: error,
    });
  }

  return new ApiError({
    kind: 'unknown',
    message: error instanceof Error ? error.message : 'Unexpected error',
    cause: error,
  });
}
