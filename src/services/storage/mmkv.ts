/**
 * MMKV — fast, synchronous key/value storage.
 *
 * Use for: UI preferences, cached non-sensitive data, Zustand persistence.
 * Do NOT use for: tokens, passwords, PII. Those go in secureStorage.ts
 * (Keychain / Keystore), because MMKV's on-device file is readable on a
 * rooted/jailbroken device.
 *
 * Instances are namespaced by environment so a dev build can never read or
 * clobber a production build's cache on the same device.
 */
// react-native-mmkv v4 is built on Nitro modules: instances come from the
// `createMMKV` factory rather than `new MMKV()` (which was the v2/v3 API).
import { createMMKV } from 'react-native-mmkv';

import { env } from '../../config/env';

/** General app storage: preferences, flags, cached values. */
export const storage = createMMKV({
  id: `app-storage-${env.environment}`,
});

/** Separate instance for Zustand persistence, so `storage.clearAll()` in a
 *  "clear cache" action doesn't nuke persisted state unintentionally. */
export const persistStorage = createMMKV({
  id: `app-persist-${env.environment}`,
});

/**
 * Adapter matching Zustand's `PersistStorage` / `StateStorage` interface.
 * Zustand expects getItem/setItem/removeItem; MMKV's are synchronous, which
 * is what makes hydration instant (no flash of unauthenticated content).
 */
export const zustandMMKVStorage = {
  getItem: (name: string): string | null => {
    const value = persistStorage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string): void => {
    persistStorage.set(name, value);
  },
  removeItem: (name: string): void => {
    // v4 renamed delete() -> remove()
    persistStorage.remove(name);
  },
};

/** Typed helpers so callers don't repeat JSON.parse/try-catch everywhere. */
export const storageHelpers = {
  getObject<T>(key: string): T | null {
    const raw = storage.getString(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt entry — drop it rather than crashing the caller.
      storage.remove(key);
      return null;
    }
  },

  setObject(key: string, value: unknown): void {
    storage.set(key, JSON.stringify(value));
  },

  clearAll(): void {
    storage.clearAll();
  },
};
