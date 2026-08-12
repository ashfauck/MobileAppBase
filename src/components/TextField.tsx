/**
 * Labelled text input with inline error state.
 */
import React, { forwardRef, useMemo, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { Theme } from '../theme/themes';
import { Text } from './Text';

export type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, containerStyle, onFocus, onBlur, style, ...rest },
  ref,
) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [focused, setFocused] = useState(false);

  const hasError = Boolean(error);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="label" tone="secondary" style={styles.label}>
          {label}
        </Text>
      ) : null}

      <TextInput
        ref={ref}
        style={[
          styles.input,
          focused && styles.inputFocused,
          hasError && styles.inputError,
          style,
        ]}
        placeholderTextColor={theme.colors.text.muted}
        // Announce the error to screen readers, not just sighted users.
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />

      {hasError ? (
        <Text variant="caption" tone="danger" style={styles.helper}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted" style={styles.helper}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { gap: theme.spacing.xs },
    label: { marginBottom: theme.spacing.xxs },
    input: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: theme.colors.border.subtle,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.bg.surface,
      color: theme.colors.text.primary,
      fontSize: theme.typography.size.base,
    },
    inputFocused: { borderColor: theme.colors.border.focus },
    inputError: { borderColor: theme.colors.status.danger },
    helper: { marginTop: theme.spacing.xxs },
  });
