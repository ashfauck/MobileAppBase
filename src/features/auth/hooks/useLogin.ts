/**
 * Login mutation.
 *
 * Shows the intended split: TanStack Query owns the request lifecycle
 * (pending/error/retry), Zustand owns the resulting session state.
 */
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../services/api/queryClient';
import { setSentryUser } from '../../../services/monitoring/sentry';
import { ApiError } from '../../../services/api/errors';
import { authApi, type LoginRequest } from '../api/authApi';
import { useAuthStore } from '../store/authStore';

export function useLogin() {
  const signIn = useAuthStore((s) => s.signIn);

  return useMutation({
    mutationFn: (request: LoginRequest) => authApi.login(request),

    onSuccess: async ({ user, tokens }) => {
      await signIn({ user, tokens });
      setSentryUser({ id: user.id, email: user.email });

      // Anything cached for the previous user must not leak into this session.
      await queryClient.resetQueries();
    },

    onError: (error) => {
      if (error instanceof ApiError && error.kind === 'validation') {
        // Field errors are rendered by the form; nothing to do here.
        return;
      }
    },
  });
}

export function useLogout() {
  const signOut = useAuthStore((s) => s.signOut);

  return useMutation({
    mutationFn: async () => {
      await authApi.logout();
    },
    // Runs on success AND failure: the local session must always be cleared.
    onSettled: async () => {
      await signOut();
      setSentryUser(null);
      queryClient.clear();
    },
  });
}
