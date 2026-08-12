import React, { useCallback, useEffect } from 'react';
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BootSplash from 'react-native-bootsplash';

import NotificationDetailScreen from '../features/notifications/screens/NotificationDetailScreen';
import { useAuthStore, selectAuthStatus } from '../features/auth/store/authStore';
import { navigationIntegration } from '../services/monitoring/sentry';
import { useTheme } from '../theme/ThemeProvider';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { linking } from './linking';
import { flushPendingNavigation, navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Maps our theme onto React Navigation's, so headers and cards match. */
function useNavigationTheme(): NavigationTheme {
  const { theme, isDark } = useTheme();
  const base = isDark ? NavDarkTheme : NavLightTheme;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.brand.solid,
      background: theme.colors.bg.canvas,
      card: theme.colors.bg.surface,
      text: theme.colors.text.primary,
      border: theme.colors.border.subtle,
      notification: theme.colors.status.danger,
    },
  };
}

export function RootNavigator() {
  const status = useAuthStore(selectAuthStatus);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const navigationTheme = useNavigationTheme();

  // Read the Keychain once on mount to decide which stack to show.
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const onReady = useCallback(() => {
    navigationIntegration.registerNavigationContainer(navigationRef);

    // Any navigation requested before the container mounted (cold start from a
    // notification tap) is replayed here.
    flushPendingNavigation();

    // Hide the native splash only now — doing it earlier shows a blank frame
    // between the splash disappearing and the first screen painting.
    void BootSplash.hide({ fade: true });
  }, []);

  // Keep the splash up while we check for a stored session.
  if (status === 'bootstrapping') {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} linking={linking} onReady={onReady}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'authenticated' ? (
          <Stack.Group>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen
              name="NotificationDetail"
              component={NotificationDetailScreen}
              options={{
                headerShown: true,
                title: '',
                presentation: 'modal',
              }}
            />
          </Stack.Group>
        ) : (
          // Conditionally rendering the stacks (rather than navigating between
          // them) is what makes the auth transition safe: there is no way to
          // press "back" from the app into the login screen, and no stale
          // authenticated screens survive a sign-out.
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
