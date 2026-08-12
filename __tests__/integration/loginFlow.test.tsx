/**
 * Integration test: the login screen through to authenticated state.
 *
 * Renders the real screen with the real store, query client and theme —
 * only the network layer is stubbed. This is the test that would actually catch
 * a regression in the auth wiring, which a shallow unit test would not.
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LoginScreen from '../../src/features/auth/screens/LoginScreen';
import { authApi } from '../../src/features/auth/api/authApi';
import { useAuthStore } from '../../src/features/auth/store/authStore';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { secureStorage } from '../../src/services/storage/secureStorage';
import { ApiError } from '../../src/services/api/errors';
import { queryClient as appQueryClient } from '../../src/services/api/queryClient';
import { initI18n } from '../../src/services/i18n';

initI18n();

jest.mock('../../src/features/auth/api/authApi');
const mockedAuthApi = authApi as jest.Mocked<typeof authApi>;

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
} as never;

const route = { key: 'Login', name: 'Login' as const, params: undefined } as never;

async function renderLogin() {
  // A fresh QueryClient per test prevents cache bleed between cases.
  //   retry: false  — a failing mutation would otherwise take 3 retries × backoff.
  //   gcTime: 0     — with the 5-minute default, every settled mutation schedules
  //                   a garbage-collection setTimeout that outlives the test and
  //                   makes Jest hang with "did not exit one second after...".
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false, gcTime: 0 },
      queries: { retry: false, gcTime: 0 },
    },
  });

  return await render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NavigationContainer>
          <LoginScreen navigation={navigation} route={route} />
        </NavigationContainer>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await secureStorage.clearTokens();
  useAuthStore.setState({ status: 'unauthenticated', user: null });
});

afterEach(() => {
  // useLogin's onSuccess touches the app-wide queryClient singleton (not the
  // per-test one), and its default 5-minute gcTime leaves a pending timer that
  // keeps the Jest worker alive after the run. Clearing it here is what stops
  // "Jest did not exit one second after the test run has completed".
  appQueryClient.clear();
  appQueryClient.unmount();
});

afterAll(() => {
  jest.useRealTimers();
});

describe('login flow', () => {
  it('rejects an invalid email before hitting the network', async () => {
    await renderLogin();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText("That doesn't look like a valid email")).toBeOnTheScreen();
    expect(mockedAuthApi.login).not.toHaveBeenCalled();
  });

  it('rejects a short password before hitting the network', async () => {
    await renderLogin();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'user@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'short');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeOnTheScreen();
    expect(mockedAuthApi.login).not.toHaveBeenCalled();
  });

  it('signs in, persists tokens and flips auth status', async () => {
    mockedAuthApi.login.mockResolvedValue({
      user: { id: 'u1', email: 'user@example.com', name: 'User' },
      tokens: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: Date.now() + 3_600_000,
      },
    });

    await renderLogin();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'User@Example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('authenticated');
    });

    // Email is normalized before it reaches the API.
    expect(mockedAuthApi.login).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });

    expect(useAuthStore.getState().user?.name).toBe('User');
    // The session must actually be on disk, not just in memory.
    expect(await secureStorage.getTokens()).toMatchObject({ accessToken: 'access-1' });
  });

  it('shows a friendly message and stays signed out when credentials are rejected', async () => {
    mockedAuthApi.login.mockRejectedValue(
      new ApiError({ kind: 'unauthorized', message: 'Invalid credentials', status: 401 }),
    );

    await renderLogin();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'user@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrongpassword');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeOnTheScreen();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(await secureStorage.getTokens()).toBeNull();
  });

  it('surfaces server-side field errors on the right input', async () => {
    mockedAuthApi.login.mockRejectedValue(
      new ApiError({
        kind: 'validation',
        message: 'Validation failed',
        status: 422,
        fieldErrors: { email: ['This account has been disabled'] },
      }),
    );

    await renderLogin();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'user@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('This account has been disabled')).toBeOnTheScreen();
  });

  it('disables the form while the request is in flight', async () => {
    let resolveLogin: (value: never) => void = () => {};
    mockedAuthApi.login.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve as (value: never) => void;
      }),
    );

    await renderLogin();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'user@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    // A second press must not fire a second request.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(mockedAuthApi.login).toHaveBeenCalledTimes(1);

    resolveLogin({
      user: { id: 'u1', email: 'user@example.com', name: 'User' },
      tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 1000 },
    } as never);

    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
  });
});
