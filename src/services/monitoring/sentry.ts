/**
 * Crash and error reporting.
 *
 * Sentry is initialized only when a DSN is compiled in, so dev builds stay
 * quiet by default and the template runs with no Sentry account at all.
 */
import * as Sentry from '@sentry/react-native';

import { env } from '../../config/env';
import { ApiError } from '../api/errors';

export const navigationIntegration = Sentry.reactNavigationIntegration({
  // Stops a screen transition trace from running forever if a screen never
  // settles (e.g. an infinite spinner).
  enableTimeToInitialDisplay: true,
});

export function initSentry(): void {
  if (!env.sentry.enabled) {
    if (env.isDev) console.info('[sentry] No DSN configured — error reporting disabled.');
    return;
  }

  Sentry.init({
    dsn: env.sentry.dsn,
    environment: env.environment,

    // Ties an event to a specific build. Your CI should upload source maps
    // under the same release/dist or stack traces stay minified.
    // release is set automatically from the native build; override in CI if needed.
    dist: undefined,

    tracesSampleRate: env.sentry.tracesSampleRate,
    // Session replay is expensive on mobile; sample errors only.
    replaysOnErrorSampleRate: env.isProd ? 0.1 : 0,
    replaysSessionSampleRate: 0,

    integrations: [navigationIntegration],

    // Don't report noise.
    beforeSend(event, hint) {
      const error = hint?.originalException;

      if (error instanceof ApiError) {
        // A user being offline is not an application bug. Reporting these
        // drowns the real errors and burns quota.
        if (error.kind === 'network' || error.kind === 'cancelled') return null;
        // Expected auth expiry, already handled by the refresh flow.
        if (error.kind === 'unauthorized') return null;

        event.tags = { ...event.tags, api_error_kind: error.kind };
        event.fingerprint = ['api', error.kind, String(error.status ?? 'none')];
      }

      return event;
    },

    // Scrub anything that could carry credentials before it leaves the device.
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'http' && breadcrumb.data?.url) {
        const url = String(breadcrumb.data.url);
        if (url.includes('/auth/')) {
          breadcrumb.data = { ...breadcrumb.data, body: '[redacted]' };
        }
      }
      return breadcrumb;
    },
  });

  Sentry.setTag('app_environment', env.environment);
  Sentry.setTag('app_id', env.appId);
}

/** Attach the signed-in user so events are attributable. Call on login. */
export function setSentryUser(user: { id: string; email: string } | null): void {
  if (!env.sentry.enabled) return;
  // Send the id only; the email is PII you probably don't need in Sentry.
  Sentry.setUser(user ? { id: user.id } : null);
}

/** Report a handled error with context. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!env.sentry.enabled) {
    console.error('[error]', error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export { Sentry };
