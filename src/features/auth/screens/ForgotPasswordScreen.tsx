import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { TextField } from '../../../components/TextField';
import { ApiError } from '../../../services/api/errors';
import type { AuthScreenProps } from '../../../navigation/types';
import { authApi } from '../api/authApi';

export default function ForgotPasswordScreen({
  route,
  navigation,
}: AuthScreenProps<'ForgotPassword'>) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(route.params?.email ?? '');

  // Explicit generics: without them TError widens to `never` here (the
  // mutationFn resolves to void), and `error instanceof ApiError` won't compile.
  const request = useMutation<void, ApiError>({
    mutationFn: () => authApi.requestPasswordReset(email.trim().toLowerCase()),
  });

  // Always report success, even on failure. Telling the caller that an email
  // isn't registered is an account-enumeration leak.
  const submitted = request.isSuccess || request.isError;

  // Read the error BEFORE the `submitted` branch below. TypeScript narrows the
  // mutation result via that aliased condition, so inside the else branch
  // `request.error` is typed `null` and any access to it fails to compile.
  const emailError =
    request.error instanceof ApiError && request.error.kind === 'validation'
      ? request.error.userMessage
      : undefined;

  return (
    <Screen scrollable keyboardAvoiding contentContainerStyle={styles.content}>
      <Text variant="title">{t('auth.forgotPassword')}</Text>

      {submitted ? (
        <View style={styles.body}>
          <Text tone="secondary">
            If an account exists for {email.trim()}, we've sent password reset instructions.
          </Text>
          <Button title={t('common.ok')} onPress={() => navigation.goBack()} fullWidth />
        </View>
      ) : (
        <View style={styles.body}>
          <TextField
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            error={emailError}
            editable={!request.isPending}
          />

          <Button
            title={t('common.save')}
            onPress={() => request.mutate()}
            loading={request.isPending}
            disabled={!email.trim()}
            fullWidth
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: 24 },
  body: { gap: 16 },
});
