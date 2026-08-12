/**
 * Theme context.
 *
 * Resolves the user's preference ('light' | 'dark' | 'system') against the OS
 * appearance and exposes the resulting theme object plus helpers.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

import { useSettingsStore } from '../store/settingsStore';
import { darkTheme, lightTheme, type Theme, type ThemeName, type ThemePreference } from './themes';

type ThemeContextValue = {
  theme: Theme;
  /** The theme actually in effect right now. */
  themeName: ThemeName;
  /** What the user selected — may be 'system'. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSettingsStore((s) => s.themePreference);
  const setPreference = useSettingsStore((s) => s.setThemePreference);

  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    () => Appearance.getColorScheme() ?? 'light',
  );

  useEffect(() => {
    // Appearance.addChangeListener fires on OS theme change AND, on iOS, when
    // the app returns from the background having missed a change.
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const resolved: ThemeName =
      preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

    return {
      theme: resolved === 'dark' ? darkTheme : lightTheme,
      themeName: resolved,
      preference,
      setPreference,
      isDark: resolved === 'dark',
    };
  }, [preference, systemScheme, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside <ThemeProvider>.');
  }
  return context;
}

/**
 * Builds themed styles without recreating the StyleSheet on every render.
 *
 *   const styles = useThemedStyles(createStyles);
 *   const createStyles = (t: Theme) => StyleSheet.create({ ... });
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const { theme } = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
