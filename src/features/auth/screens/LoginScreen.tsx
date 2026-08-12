import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { TextField } from '../../../components/TextField';
import { ApiError } from '../../../services/api/errors';
import { useTheme } from '../../../theme/ThemeProvider';
import type { AuthScreenProps } from '../../../navigation/types';
import { useLogin } from '../hooks/useLogin';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export default function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const login = useLogin();

  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = useCallback((): boolean => {
    const next: { email?: string; password?: string } = {};

    if (!email.trim()) next.email = t('auth.errors.emailRequired');
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = t('auth.errors.emailInvalid');

    if (!password) next.password = t('auth.errors.passwordRequired');
    else if (password.length < MIN_PASSWORD_LENGTH)
      next.password = t('auth.errors.passwordTooShort');

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [email, password, t]);

  const onSubmit = useCallback(() => {
    if (!validate()) return;
    login.mutate({ email: email.trim().toLowerCase(), password });
  }, [validate, login, email, password]);

  // Server-side field errors take priority over the local ones.
  const serverError = login.error instanceof ApiError ? login.error : null;
  const serverFieldErrors = serverError?.fieldErrors;

  return (
    <Screen scrollable keyboardAvoiding contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="displayLarge">{t('auth.welcomeBack')}</Text>
        <Text tone="secondary" style={styles.subtitle}>
          {t('auth.signInSubtitle', { appName: t('common.appName') })}
        </Text>
      </View>

      <View style={styles.form}>
        <TextField
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          error={errors.email ?? serverFieldErrors?.email?.[0]}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!login.isPending}
        />

        <TextField
          ref={passwordRef}
          label={t('auth.password')}
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          error={errors.password ?? serverFieldErrors?.password?.[0]}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          editable={!login.isPending}
        />

        {/* Non-field errors (bad credentials, server down). */}
        {serverError && !serverFieldErrors ? (
          <View
            style={[styles.errorBanner, { backgroundColor: theme.colors.status.dangerSubtle }]}>
            <Text variant="caption" tone="danger">
              {serverError.userMessage}
            </Text>
          </View>
        ) : null}

        <Button
          title={t('auth.signIn')}
          onPress={onSubmit}
          loading={login.isPending}
          fullWidth
          size="lg"
        />

        <Button
          title={t('auth.forgotPassword')}
          variant="ghost"
          onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() })}
          disabled={login.isPending}
        />
      </View>

      <Text variant="caption" tone="muted" style={styles.hint}>
        {t('auth.demoHint')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  header: { marginBottom: 32 },
  subtitle: { marginTop: 8 },
  form: { gap: 16 },
  errorBanner: { padding: 12, borderRadius: 8 },
  hint: { marginTop: 32, textAlign: 'center' },
});
