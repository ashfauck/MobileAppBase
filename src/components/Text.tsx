/**
 * Themed Text.
 *
 * Wrapping RN's Text is worth it for three reasons:
 *   - colors come from the theme, so dark mode needs no per-screen work;
 *   - `variant` keeps typography consistent instead of ad-hoc fontSize values;
 *   - `allowFontScaling` can be capped centrally (a 200% system font otherwise
 *     destroys most layouts).
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { Theme } from '../theme/themes';

export type TextVariant =
  | 'displayLarge'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label';

export type TextTone = 'primary' | 'secondary' | 'muted' | 'inverse' | 'link' | 'danger' | 'success';

export type AppTextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
};

export function Text({
  variant = 'body',
  tone = 'primary',
  style,
  maxFontSizeMultiplier = 1.4,
  ...rest
}: AppTextProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[styles[variant], styles[`tone_${tone}`], style]}
      {...rest}
    />
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    displayLarge: {
      fontSize: theme.typography.size.xxxl,
      lineHeight: theme.typography.lineHeight.xxxl,
      fontWeight: theme.typography.weight.bold,
    },
    title: {
      fontSize: theme.typography.size.xxl,
      lineHeight: theme.typography.lineHeight.xxl,
      fontWeight: theme.typography.weight.bold,
    },
    subtitle: {
      fontSize: theme.typography.size.lg,
      lineHeight: theme.typography.lineHeight.lg,
      fontWeight: theme.typography.weight.semibold,
    },
    body: {
      fontSize: theme.typography.size.base,
      lineHeight: theme.typography.lineHeight.base,
      fontWeight: theme.typography.weight.regular,
    },
    bodyStrong: {
      fontSize: theme.typography.size.base,
      lineHeight: theme.typography.lineHeight.base,
      fontWeight: theme.typography.weight.semibold,
    },
    caption: {
      fontSize: theme.typography.size.xs,
      lineHeight: theme.typography.lineHeight.xs,
      fontWeight: theme.typography.weight.regular,
    },
    label: {
      fontSize: theme.typography.size.sm,
      lineHeight: theme.typography.lineHeight.sm,
      fontWeight: theme.typography.weight.medium,
    },

    tone_primary: { color: theme.colors.text.primary },
    tone_secondary: { color: theme.colors.text.secondary },
    tone_muted: { color: theme.colors.text.muted },
    tone_inverse: { color: theme.colors.text.inverse },
    tone_link: { color: theme.colors.text.link },
    tone_danger: { color: theme.colors.status.danger },
    tone_success: { color: theme.colors.status.success },
  });
