/**
 * Typed, validated access to build-time environment variables.
 *
 * Values come from react-native-config, which reads the .env file selected by
 * the ENVFILE variable at BUILD time (see package.json scripts) and bakes the
 * result into the native binary.
 *
 * Why validate at startup instead of trusting Config?
 *   react-native-config returns `undefined` for any key missing from the .env
 *   that was compiled in. That failure is silent and surfaces much later as a
 *   confusing runtime bug (e.g. axios requesting "undefined/users"). We fail
 *   loudly here instead, at the first import, where the cause is obvious.
 */
import Config from 'react-native-config';

import { APP_IDENTITY, type AppEnvironment } from './identity.generated';

const VALID_ENVIRONMENTS: readonly AppEnvironment[] = ['dev', 'staging', 'prod'];

class EnvConfigError extends Error {
  constructor(message: string) {
    super(`[env] ${message}`);
    this.name = 'EnvConfigError';
  }
}

function requireString(key: string): string {
  const value = Config[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new EnvConfigError(
      `Missing required variable "${key}". Did you build with ENVFILE set? ` +
        `Try: npm run ios:dev / npm run android:dev`,
    );
  }
  return value.trim();
}

function optionalString(key: string, fallback = ''): string {
  const value = Config[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function requireNumber(key: string, fallback: number): number {
  const raw = Config[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new EnvConfigError(`Variable "${key}" must be numeric, received "${raw}".`);
  }
  return parsed;
}

function requireBoolean(key: string, fallback: boolean): boolean {
  const raw = Config[key];
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1';
}

function resolveEnvironment(): AppEnvironment {
  const raw = optionalString('APP_ENV', 'dev');
  if (!VALID_ENVIRONMENTS.includes(raw as AppEnvironment)) {
    throw new EnvConfigError(
      `APP_ENV is "${raw}" but must be one of: ${VALID_ENVIRONMENTS.join(', ')}.`,
    );
  }
  return raw as AppEnvironment;
}

const environment = resolveEnvironment();

export const env = {
  /** 'dev' | 'staging' | 'prod' */
  environment,

  /** Bundle id / applicationId this binary was built with. */
  appId: APP_IDENTITY[environment].appId,
  /** Springboard / launcher label for this binary. */
  displayName: APP_IDENTITY[environment].displayName,

  api: {
    baseUrl: requireString('API_URL'),
    timeoutMs: requireNumber('API_TIMEOUT_MS', 15_000),
  },

  sentry: {
    dsn: optionalString('SENTRY_DSN'),
    tracesSampleRate: requireNumber('SENTRY_TRACES_SAMPLE_RATE', 0.2),
    get enabled() {
      return optionalString('SENTRY_DSN') !== '';
    },
  },

  flags: {
    devMenu: requireBoolean('ENABLE_DEV_MENU', false),
  },

  logLevel: optionalString('LOG_LEVEL', 'error') as 'debug' | 'info' | 'warn' | 'error',

  isDev: environment === 'dev',
  isStaging: environment === 'staging',
  isProd: environment === 'prod',
} as const;

export type Env = typeof env;
