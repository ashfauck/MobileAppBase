/**
 * Screen container.
 *
 * Handles the three things every screen needs and everyone forgets:
 *   - safe-area insets (notch, home indicator, Android 15 edge-to-edge);
 *   - a status bar style that matches the theme;
 *   - keyboard avoidance, which behaves differently on each platform.
 */
import React, { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import type { Theme } from '../theme/themes';

export type ScreenProps = {
  children: React.ReactNode;
  /** Wrap content in a ScrollView. Off by default — a ScrollView around a
   *  FlatList/FlashList is a common and expensive mistake. */
  scrollable?: boolean;
  /** Which safe-area edges to pad. Tab screens usually omit 'bottom' because
   *  the tab bar already handles it. */
  edges?: readonly Edge[];
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardAvoiding?: boolean;
};

export function Screen({
  children,
  scrollable = false,
  edges = ['top', 'bottom', 'left', 'right'],
  padded = true,
  style,
  contentContainerStyle,
  keyboardAvoiding = false,
}: ScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Applying insets manually rather than with <SafeAreaView> lets callers pick
  // edges per screen, which SafeAreaView can't express as cleanly.
  const insetStyle: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  const body = scrollable ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[padded && styles.padded, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, contentContainerStyle]}>{children}</View>
  );

  return (
    <View style={[styles.container, insetStyle, style]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          // 'padding' is correct on iOS; on Android the system already resizes
          // the window (windowSoftInputMode=adjustResize), so adding padding
          // double-counts and pushes content off-screen.
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg.canvas,
    },
    flex: { flex: 1 },
    padded: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
    },
  });
