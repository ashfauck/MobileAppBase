import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import DeviceInfo from 'react-native-device-info';

import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { env } from '../../../config/env';
import { changeLanguage } from '../../../services/i18n';
import { useSettingsStore, type SupportedLanguage } from '../../../store/settingsStore';
import { useTheme } from '../../../theme/ThemeProvider';
import type { ThemePreference } from '../../../theme/themes';
import { useLogout } from '../../auth/hooks/useLogin';
import { useAuthStore, selectUser } from '../../auth/store/authStore';

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];
const LANGUAGE_OPTIONS: SupportedLanguage[] = ['en', 'es'];

/** Segmented selector shared by the theme and language rows. */
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  labelFor: (option: T) => string;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.segment, { borderColor: theme.colors.border.subtle }]}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[
              styles.segmentItem,
              active && { backgroundColor: theme.colors.brand.solid },
            ]}>
            <Text variant="label" tone={active ? 'inverse' : 'secondary'}>
              {labelFor(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { theme, preference, setPreference } = useTheme();

  const user = useAuthStore(selectUser);
  const language = useSettingsStore((s) => s.language);
  const logout = useLogout();

  return (
    <Screen scrollable edges={['top', 'left', 'right']}>
      <Text variant="title">{t('settings.title')}</Text>

      {user ? (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle },
          ]}>
          <Text variant="bodyStrong">{user.name}</Text>
          <Text variant="caption" tone="muted">
            {user.email}
          </Text>
        </View>
      ) : null}

      <Text variant="subtitle" style={styles.sectionTitle}>
        {t('settings.appearance')}
      </Text>
      <SegmentedControl
        options={THEME_OPTIONS}
        value={preference}
        onChange={setPreference}
        labelFor={(option) => t(`settings.theme.${option}`)}
      />

      <Text variant="subtitle" style={styles.sectionTitle}>
        {t('settings.language')}
      </Text>
      <SegmentedControl
        options={LANGUAGE_OPTIONS}
        value={language}
        onChange={(next) => {
          void changeLanguage(next);
        }}
        labelFor={(option) => t(`settings.languages.${option}`)}
      />

      <Text variant="subtitle" style={styles.sectionTitle}>
        {t('settings.about')}
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle },
        ]}>
        <View style={styles.row}>
          <Text variant="label" tone="muted">
            {t('settings.version')}
          </Text>
          <Text variant="label">
            {DeviceInfo.getVersion()} ({DeviceInfo.getBuildNumber()})
          </Text>
        </View>
        <View style={styles.row}>
          <Text variant="label" tone="muted">
            {t('settings.environment')}
          </Text>
          <Text variant="label">{env.environment}</Text>
        </View>
        <View style={styles.row}>
          <Text variant="label" tone="muted">
            {t('settings.bundleId')}
          </Text>
          <Text variant="label" numberOfLines={1} style={styles.rowValue}>
            {env.appId}
          </Text>
        </View>
      </View>

      <Button
        title={t('auth.signOut')}
        variant="danger"
        onPress={() => logout.mutate()}
        loading={logout.isPending}
        fullWidth
        style={styles.signOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  sectionTitle: { marginTop: 24, marginBottom: 8 },
  segment: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  signOut: { marginTop: 32 },
});
