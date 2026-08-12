/**
 * The error normalizer is the one piece every screen depends on, so it's worth
 * covering each axios failure shape explicitly.
 */
import { AxiosError, AxiosHeaders } from 'axios';

import { ApiError, normalizeError } from '../../src/services/api/errors';

function axiosErrorWithResponse(status: number, data: unknown = {}): AxiosError {
  const error = new AxiosError('Request failed');
  error.response = {
    status,
    statusText: '',
    data,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  } as AxiosError['response'];
  return error;
}

describe('normalizeError', () => {
  it('maps 401 to unauthorized', () => {
    const error = normalizeError(axiosErrorWithResponse(401));
    expect(error.kind).toBe('unauthorized');
    expect(error.status).toBe(401);
    expect(error.isRetryable).toBe(false);
  });

  it('maps 403 / 404 / 429', () => {
    expect(normalizeError(axiosErrorWithResponse(403)).kind).toBe('forbidden');
    expect(normalizeError(axiosErrorWithResponse(404)).kind).toBe('notFound');
    expect(normalizeError(axiosErrorWithResponse(429)).kind).toBe('rateLimited');
  });

  it('maps 5xx to server and marks it retryable', () => {
    const error = normalizeError(axiosErrorWithResponse(503));
    expect(error.kind).toBe('server');
    expect(error.isRetryable).toBe(true);
  });

  it('extracts field errors from a 422', () => {
    const error = normalizeError(
      axiosErrorWithResponse(422, {
        message: 'Validation failed',
        errors: { email: ['Email is already taken'] },
      }),
    );

    expect(error.kind).toBe('validation');
    expect(error.fieldErrors?.email?.[0]).toBe('Email is already taken');
    // Validation messages are written for users, so they pass through verbatim.
    expect(error.userMessage).toBe('Validation failed');
  });

  it('treats a response-less axios error as a network failure', () => {
    const error = normalizeError(new AxiosError('Network Error'));
    expect(error.kind).toBe('network');
    expect(error.isRetryable).toBe(true);
  });

  it('detects a timeout by error code', () => {
    const axiosError = new AxiosError('timeout exceeded');
    axiosError.code = 'ECONNABORTED';

    const error = normalizeError(axiosError);
    expect(error.kind).toBe('timeout');
    expect(error.isRetryable).toBe(true);
  });

  it('passes an existing ApiError through unchanged', () => {
    const original = new ApiError({ kind: 'forbidden', message: 'nope' });
    expect(normalizeError(original)).toBe(original);
  });

  it('wraps a non-axios throwable', () => {
    const error = normalizeError(new Error('boom'));
    expect(error.kind).toBe('unknown');
    expect(error.message).toBe('boom');
  });

  it('never leaks a raw message for non-validation kinds', () => {
    const error = normalizeError(axiosErrorWithResponse(500, { message: 'NullPointerException at line 42' }));
    expect(error.userMessage).not.toContain('NullPointerException');
  });
});
