import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';

import { RootNavigator } from '../navigation/RootNavigator';
import { queryClient, setUpQueryFocusManager } from '../services/api/queryClient';
import { setAuthFailureHandler } from '../services/api/client';
import i18n, { initI18n } from '../services/i18n';
import { initializeNotifications } from '../services/notifications/pushService';
import { useAuthStore } from '../features/auth/store/authStore';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ErrorBoundary } from './ErrorBoundary';

// i18n must be initialized before the first render so no screen flashes an
// untranslated key. Safe at module scope: MMKV reads are synchronous.
initI18n();

export default function App() {
  useEffect(() => {
    // Bridges AppState -> TanStack Query's refetch-on-focus.
    const teardownFocus = setUpQueryFocusManager();

    // Wiring the auth-failure callback here (rather than importing the store
    // inside client.ts) keeps the api layer free of a circular dependency.
    setAuthFailureHandler(() => {
      void useAuthStore.getState().signOut();
    });

    // Channels, iOS categories, and foreground listeners.
    //
    // The catch matters: getMessaging() throws when no google-services.json /
    // GoogleService-Info.plist is present. Without it, a fresh clone that hasn't
    // set up Firebase yet gets an unhandled promise rejection on every launch.
    // Push simply stays inactive instead.
    let teardownNotifications: (() => void) | undefined;
    initializeNotifications()
      .then((cleanup) => {
        teardownNotifications = cleanup;
      })
      .catch((error: unknown) => {
        console.warn('[app] Notification setup failed — push is disabled.', error);
      });

    return () => {
      teardownFocus();
      teardownNotifications?.();
    };
  }, []);

  return (
    // GestureHandlerRootView must be the outermost view or gestures silently
    // fail on Android.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            {/* ThemeProvider sits inside the boundary so a theme error still
                renders the (theme-free) fallback UI. */}
            <ErrorBoundary>
              <ThemeProvider>
                <RootNavigator />
              </ThemeProvider>
            </ErrorBoundary>
          </QueryClientProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
