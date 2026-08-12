/**
 * Themed pressable button.
 *
 * Accessibility and touch-target size are handled here once so no screen has to
 * remember them: minimum 44pt height (Apple HIG / Android 48dp), a real
 * `accessibilityRole`, and `accessibilityState` reflecting disabled/busy.
 */
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { Theme } from '../theme/themes';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // A loading button must not be pressable, or a double tap fires the action twice.
  const isDisabled = disabled === true || loading;

  const textTone = variant === 'primary' || variant === 'danger' ? 'inverse' : 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={title}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[`size_${size}`],
        styles[`variant_${variant}`],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles[`pressed_${variant}`],
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              variant === 'primary' || variant === 'danger'
                ? theme.colors.brand.onSolid
                : theme.colors.text.primary
            }
          />
        ) : (
          <>
            {leftIcon}
            <Text variant="bodyStrong" tone={textTone}>
              {title}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    base: {
      borderRadius: theme.radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'transparent',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    fullWidth: { alignSelf: 'stretch' },

    // 44 is the minimum comfortable touch target; don't go below it.
    size_sm: { minHeight: 36, paddingHorizontal: theme.spacing.md },
    size_md: { minHeight: 44, paddingHorizontal: theme.spacing.base },
    size_lg: { minHeight: 52, paddingHorizontal: theme.spacing.lg },

    variant_primary: { backgroundColor: theme.colors.brand.solid },
    variant_secondary: {
      backgroundColor: theme.colors.bg.surface,
      borderColor: theme.colors.border.strong,
    },
    variant_ghost: { backgroundColor: 'transparent' },
    variant_danger: { backgroundColor: theme.colors.status.danger },

    pressed_primary: { backgroundColor: theme.colors.brand.solidPressed },
    pressed_secondary: { backgroundColor: theme.colors.bg.canvas },
    pressed_ghost: { backgroundColor: theme.colors.bg.canvas },
    pressed_danger: { opacity: 0.85 },

    disabled: { opacity: 0.5 },
  });
