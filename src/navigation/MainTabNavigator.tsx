import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

import { Text } from '../components/Text';
import HomeScreen from '../features/home/screens/HomeScreen';
import NotificationsScreen from '../features/notifications/screens/NotificationsScreen';
import SettingsScreen from '../features/settings/screens/SettingsScreen';
import TasksScreen from '../features/tasks/screens/TasksScreen';
import { useTheme } from '../theme/ThemeProvider';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Placeholder glyph icons.
 *
 * Swap for react-native-svg icons or a vector icon set. Kept dependency-free
 * here so the template has no icon-font linking step to get wrong.
 */
function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <View style={styles.icon}>
      <Text style={[styles.glyph, { opacity: focused ? 1 : 0.5 }]}>{glyph}</Text>
    </View>
  );
}

export function MainTabNavigator() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand.solid,
        tabBarInactiveTintColor: theme.colors.text.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.bg.surface,
          borderTopColor: theme.colors.border.subtle,
        },
        tabBarLabelStyle: { fontSize: theme.typography.size.xs },
        // Keeps the tab bar above the home indicator / gesture area without
        // each screen having to pad for it.
        tabBarHideOnKeyboard: true,
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: t('home.title'),
          tabBarIcon: ({ focused }) => <TabIcon glyph="⌂" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          title: t('tasks.title'),
          tabBarIcon: ({ focused }) => <TabIcon glyph="✓" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: t('notifications.title'),
          tabBarIcon: ({ focused }) => <TabIcon glyph="◔" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t('settings.title'),
          tabBarIcon: ({ focused }) => <TabIcon glyph="⚙" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 20 },
});
