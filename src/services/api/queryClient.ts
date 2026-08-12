/**
 * TanStack Query configuration tuned for mobile.
 *
 * Mobile differs from web in ways the defaults don't account for:
 *   - "Focus" means app foreground, not window focus. Wired via focusManager.
 *   - Connectivity flaps constantly. Retrying a request that failed because the
 *     device is in a lift is correct; retrying a 404 is not.
 *   - Screens are remounted often by the navigator, so a too-short staleTime
 *     causes a refetch every time the user swipes back.
 */
import { QueryClient, focusManager, type QueryClientConfig } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

import { ApiError } from './errors';

const config: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30s: navigating back to a screen within
      // that window renders from cache with no spinner and no request.
      staleTime: 30_000,
      // Keep unused data around for 5 minutes before garbage collecting.
      gcTime: 5 * 60_000,

      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          // Never retry a client error — the result will be identical.
          if (!error.isRetryable) return false;
        }
        return failureCount < 3;
      },
      // Exponential backoff, capped so a long outage doesn't push the retry
      // an hour into the future.
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),

      refetchOnReconnect: true,
      // Refetch when the app returns to the foreground and data is stale.
      refetchOnWindowFocus: true,
      // Mounting a screen shouldn't force a network call if data is still fresh.
      refetchOnMount: true,
    },
    mutations: {
      // Mutations are not idempotent — retrying a "create order" can double
      // charge. Opt in per-mutation instead.
      retry: false,
    },
  },
};

export const queryClient = new QueryClient(config);

/**
 * Bridges React Native's AppState to TanStack Query's focus concept.
 * Call once at startup; returns an unsubscribe function.
 */
export function setUpQueryFocusManager(): () => void {
  const onAppStateChange = (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  };

  const subscription = AppState.addEventListener('change', onAppStateChange);
  return () => subscription.remove();
}

/**
 * Centralized query keys.
 *
 * Defining them in one place (rather than inline string arrays) is what makes
 * invalidation reliable — `queryClient.invalidateQueries({ queryKey: qk.tasks.all })`
 * cannot silently miss a key because someone typed 'task' somewhere.
 */
export const qk = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    list: (filter?: string) => ['tasks', 'list', filter ?? 'all'] as const,
    detail: (id: string) => ['tasks', 'detail', id] as const,
  },
} as const;
