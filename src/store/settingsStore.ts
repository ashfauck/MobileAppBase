/**
 * App-wide user preferences (theme, language).
 *
 * Persisted to MMKV so the choice survives restarts. Because MMKV is
 * synchronous, Zustand rehydrates during the first render — there is no
 * "flash of light theme" before the stored preference loads.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandMMKVStorage } from '../services/storage/mmkv';
import type { ThemePreference } from '../theme/themes';

export type SupportedLanguage = 'en' | 'es';

type SettingsState = {
  themePreference: ThemePreference;
  language: SupportedLanguage;
  /** Whether the user has been asked for notification permission at least once. */
  hasRequestedPushPermission: boolean;
};

type SettingsActions = {
  setThemePreference: (preference: ThemePreference) => void;
  setLanguage: (language: SupportedLanguage) => void;
  markPushPermissionRequested: () => void;
  reset: () => void;
};

const initialState: SettingsState = {
  themePreference: 'system',
  language: 'en',
  hasRequestedPushPermission: false,
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...initialState,

      setThemePreference: (themePreference) => set({ themePreference }),
      setLanguage: (language) => set({ language }),
      markPushPermissionRequested: () => set({ hasRequestedPushPermission: true }),
      reset: () => set(initialState),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => zustandMMKVStorage),
      version: 1,
      /**
       * Bump `version` and handle the old shape here when you rename or remove
       * a field. Without this, users upgrading the app rehydrate a stale shape
       * and you get undefined values in production only.
       */
      migrate: (persisted, fromVersion) => {
        if (fromVersion === 0) {
          return { ...initialState, ...(persisted as Partial<SettingsState>) };
        }
        return persisted as SettingsState & SettingsActions;
      },
    },
  ),
);

/* --------------------------------------------------------------- selectors ---
 * Exported selectors keep components subscribed to the narrowest slice possible.
 * `useSettingsStore(s => s.language)` re-renders only when language changes;
 * `useSettingsStore()` (no selector) re-renders on ANY state change.
 */
export const selectThemePreference = (s: SettingsState) => s.themePreference;
export const selectLanguage = (s: SettingsState) => s.language;
