import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import DeviceInfo from 'react-native-device-info';

import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { env } from '../../../config/env';
import { useAuthStore, selectUser } from '../../auth/store/authStore';
import { useTheme } from '../../../theme/ThemeProvider';

/** Small labelled row used by the build-info card. */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Text variant="label" style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const user = useAuthStore(selectUser);

  return (
    <Screen scrollable edges={['top', 'left', 'right']}>
      <Text variant="displayLarge">{t('home.greeting', { name: user?.name ?? 'there' })}</Text>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle },
        ]}>
        <Text variant="subtitle" style={styles.cardTitle}>
          {t('home.environmentCard')}
        </Text>

        {/* Proves the flavor wiring end to end: these values differ per build. */}
        <InfoRow label={t('settings.environment')} value={env.environment} />
        <InfoRow label={t('settings.bundleId')} value={env.appId} />
        <InfoRow label="Display name" value={env.displayName} />
        <InfoRow label="API base URL" value={env.api.baseUrl} />
        <InfoRow
          label={t('settings.version')}
          value={`${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`}
        />
        <InfoRow label="Sentry" value={env.sentry.enabled ? 'enabled' : 'disabled'} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  cardTitle: { marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowValue: { flexShrink: 1, textAlign: 'right' },
});
