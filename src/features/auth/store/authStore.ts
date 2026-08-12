/**
 * Authentication state.
 *
 * Split of responsibilities:
 *   - Tokens          -> Keychain/Keystore (secureStorage), never in MMKV.
 *   - User profile    -> MMKV via persist, so the UI can render instantly on
 *                        cold start while the profile refetch happens in the
 *                        background.
 *   - status          -> derived lifecycle, never persisted (a persisted
 *                        'authenticated' would lie if the Keychain entry was
 *                        wiped by an OS restore).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandMMKVStorage } from '../../../services/storage/mmkv';
import { secureStorage, type AuthTokens } from '../../../services/storage/secureStorage';

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
};

export type AuthStatus =
  /** Checking the Keychain on app launch. Show the splash, not the login screen. */
  | 'bootstrapping'
  | 'authenticated'
  | 'unauthenticated';

type AuthState = {
  status: AuthStatus;
  user: User | null;
};

type AuthActions = {
  /** Reads persisted tokens on launch and decides the initial route. */
  bootstrap: () => Promise<void>;
  /** Called after a successful login/register response. */
  signIn: (payload: { user: User; tokens: AuthTokens }) => Promise<void>;
  /** Clears tokens and returns to the auth stack. */
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
};

const initialState: AuthState = {
  status: 'bootstrapping',
  user: null,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      ...initialState,

      bootstrap: async () => {
        const tokens = await secureStorage.getTokens();

        if (!tokens) {
          set({ status: 'unauthenticated', user: null });
          return;
        }

        // An expired access token is fine — the axios interceptor refreshes on
        // the first 401. But if the REFRESH token itself is unusable there is
        // nothing to recover, so treat it as logged out.
        if (secureStorage.isExpired(tokens) && !tokens.refreshToken) {
          await secureStorage.clearTokens();
          set({ status: 'unauthenticated', user: null });
          return;
        }

        set({ status: 'authenticated' });
      },

      signIn: async ({ user, tokens }) => {
        await secureStorage.saveTokens(tokens);
        set({ status: 'authenticated', user });
      },

      signOut: async () => {
        await secureStorage.clearTokens();
        // Deliberately clears the persisted user too — leaving it behind leaks
        // the previous account's name into the login screen on the next launch.
        set({ status: 'unauthenticated', user: null });
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => zustandMMKVStorage),
      version: 1,
      // Only the profile is persisted. `status` must always be recomputed by
      // bootstrap() against the real Keychain contents.
      partialize: (state) => ({ user: state.user }),
    },
  ),
);

/* --------------------------------------------------------------- selectors */
export const selectIsAuthenticated = (s: AuthState) => s.status === 'authenticated';
export const selectAuthStatus = (s: AuthState) => s.status;
export const selectUser = (s: AuthState) => s.user;

/**
 * Non-hook access for modules outside React (axios interceptors, push
 * handlers). Calling a hook there would throw.
 */
export const authStoreApi = {
  getState: useAuthStore.getState,
  signOut: () => useAuthStore.getState().signOut(),
};
