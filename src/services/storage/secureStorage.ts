/**
 * Secure credential storage backed by iOS Keychain and Android Keystore.
 *
 * Only auth tokens live here. Everything else belongs in MMKV.
 *
 * Design notes:
 *  - Tokens are stored as a single JSON blob under one service key, so the
 *    access and refresh token can never drift out of sync (two separate
 *    Keychain writes can partially fail).
 *  - Every call is wrapped: Keychain throws on some devices when the user has
 *    no passcode set, or when the keystore entry was invalidated by a biometric
 *    change. A crash on app launch is far worse than a forced re-login, so we
 *    degrade to "no session" instead of propagating.
 */
import * as Keychain from 'react-native-keychain';

import { env } from '../../config/env';

const TOKEN_SERVICE = `${env.appId}.auth-tokens`;
/** Keychain requires a username field; the value itself is in `password`. */
const TOKEN_ACCOUNT = 'tokens';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. Used to refresh proactively instead of waiting for a 401. */
  expiresAt: number;
};

function isValidTokens(value: unknown): value is AuthTokens {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AuthTokens>;
  return (
    typeof candidate.accessToken === 'string' &&
    typeof candidate.refreshToken === 'string' &&
    typeof candidate.expiresAt === 'number'
  );
}

export const secureStorage = {
  async saveTokens(tokens: AuthTokens): Promise<boolean> {
    try {
      await Keychain.setGenericPassword(TOKEN_ACCOUNT, JSON.stringify(tokens), {
        service: TOKEN_SERVICE,
        // Tokens must be readable when the app refreshes in the background
        // (e.g. from a push handler), so we cannot require device unlock.
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
      return true;
    } catch (error) {
      console.warn('[secureStorage] Failed to persist tokens', error);
      return false;
    }
  },

  async getTokens(): Promise<AuthTokens | null> {
    try {
      const credentials = await Keychain.getGenericPassword({ service: TOKEN_SERVICE });
      if (!credentials) return null;

      const parsed: unknown = JSON.parse(credentials.password);
      if (!isValidTokens(parsed)) {
        // Shape changed between app versions — treat as logged out.
        await secureStorage.clearTokens();
        return null;
      }
      return parsed;
    } catch (error) {
      console.warn('[secureStorage] Failed to read tokens', error);
      return null;
    }
  },

  async clearTokens(): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
    } catch (error) {
      console.warn('[secureStorage] Failed to clear tokens', error);
    }
  },

  /** True when the access token is expired or within `skewMs` of expiring. */
  isExpired(tokens: AuthTokens, skewMs = 30_000): boolean {
    return Date.now() >= tokens.expiresAt - skewMs;
  },
};
