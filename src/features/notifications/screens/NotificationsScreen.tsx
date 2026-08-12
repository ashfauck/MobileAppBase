/**
 * Push notification test bench.
 *
 * Buttons here fire LOCAL notifications through the exact same
 * `displayNotification()` used for remote pushes, so what you see is what a
 * real FCM message will produce — including the category action buttons.
 *
 * Testing the remote path: copy the device token below and send yourself a
 * message (see docs/PUSH_NOTIFICATIONS.md for a ready-made curl command).
 *
 * IMPORTANT: iOS action buttons do not appear if the app is in the foreground
 * with a banner — background the app (or pull down the notification) to see them.
 * The iOS Simulator cannot receive remote pushes from FCM; local notifications
 * work fine, but token-based delivery needs a physical device.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { useTheme } from '../../../theme/ThemeProvider';
import { NOTIFICATION_CATEGORIES } from '../../../services/notifications/categories';
import {
  displayNotification,
  getFcmToken,
  getPermissionStatus,
  onTokenRefresh,
  requestNotificationPermission,
  badge,
  type PermissionResult,
} from '../../../services/notifications/pushService';
import { useSettingsStore } from '../../../store/settingsStore';

type TestCase = {
  key: string;
  labelKey: string;
  category: string;
  title: string;
  body: string;
};

const TEST_CASES: TestCase[] = [
  {
    key: 'default',
    labelKey: 'notifications.categories.default',
    category: NOTIFICATION_CATEGORIES.DEFAULT,
    title: 'Heads up',
    body: 'A plain notification with no action buttons.',
  },
  {
    key: 'invitation',
    labelKey: 'notifications.categories.invitation',
    category: NOTIFICATION_CATEGORIES.INVITATION,
    title: 'Project invitation',
    body: 'Dana invited you to collaborate on Q3 Planning.',
  },
  {
    key: 'reminder',
    labelKey: 'notifications.categories.reminder',
    category: NOTIFICATION_CATEGORIES.REMINDER,
    title: 'Task reminder',
    body: 'Ship the release build before 5pm.',
  },
  {
    key: 'message',
    labelKey: 'notifications.categories.message',
    category: NOTIFICATION_CATEGORIES.MESSAGE,
    title: 'New message',
    body: 'Sam: are we still on for the review?',
  },
];

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const [permission, setPermission] = useState<PermissionResult>('unavailable');
  const [token, setToken] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const markRequested = useSettingsStore((s) => s.markPushPermissionRequested);

  const refresh = useCallback(async () => {
    const status = await getPermissionStatus();
    setPermission(status);

    if (status === 'granted' || status === 'provisional') {
      setToken(await getFcmToken());
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Tokens rotate; keep the displayed value honest.
    const unsubscribe = onTokenRefresh(setToken);
    return unsubscribe;
  }, [refresh]);

  const onRequestPermission = useCallback(async () => {
    setRequesting(true);
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      markRequested();

      if (result === 'denied') {
        // iOS shows the system prompt only once. After a denial the only route
        // is the OS settings screen.
        Alert.alert(
          t('notifications.permission.denied'),
          'Enable notifications in system settings to receive pushes.',
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('notifications.permission.openSettings'), onPress: () => Linking.openSettings() },
          ],
        );
      } else {
        setToken(await getFcmToken());
      }
    } finally {
      setRequesting(false);
    }
  }, [markRequested, t]);

  const onSendTest = useCallback(
    async (testCase: TestCase) => {
      if (permission !== 'granted' && permission !== 'provisional') {
        Alert.alert(t('notifications.permission.denied'), 'Grant permission first.');
        return;
      }

      await displayNotification({
        title: testCase.title,
        body: testCase.body,
        category: testCase.category,
        entityId: `demo_${testCase.key}`,
        deepLink: `mobileappbase://notifications/demo_${testCase.key}`,
      });
    },
    [permission, t],
  );

  const granted = permission === 'granted' || permission === 'provisional';

  return (
    <Screen scrollable edges={['top', 'left', 'right']}>
      <Text variant="title">{t('notifications.title')}</Text>

      {/* Permission state */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle },
        ]}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: granted
                  ? theme.colors.status.success
                  : theme.colors.status.danger,
              },
            ]}
          />
          <Text variant="bodyStrong">{t(`notifications.permission.${permission}`)}</Text>
        </View>

        {!granted ? (
          <Button
            title={t('notifications.permission.request')}
            onPress={onRequestPermission}
            loading={requesting}
            fullWidth
          />
        ) : null}
      </View>

      {/* Device token */}
      {token ? (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle },
          ]}>
          <Text variant="label" tone="muted">
            {t('notifications.token')}
          </Text>
          <Text variant="caption" selectable numberOfLines={3}>
            {token}
          </Text>
          <Button
            title={t('notifications.copyToken')}
            variant="secondary"
            size="sm"
            onPress={() => {
              Clipboard.setString(token);
              Alert.alert(t('notifications.copied'));
            }}
          />
        </View>
      ) : null}

      {/* Category test buttons */}
      <Text variant="subtitle" style={styles.sectionTitle}>
        {t('notifications.sendTest')}
      </Text>

      <View style={styles.buttons}>
        {TEST_CASES.map((testCase) => (
          <Button
            key={testCase.key}
            title={t(testCase.labelKey)}
            variant="secondary"
            onPress={() => onSendTest(testCase)}
            disabled={!granted}
            fullWidth
          />
        ))}
      </View>

      <Text variant="caption" tone="muted" style={styles.note}>
        {Platform.OS === 'ios'
          ? 'iOS: background the app or pull the banner down to reveal action buttons. Remote pushes require a physical device.'
          : 'Android: expand the notification to reveal action buttons.'}
      </Text>

      <Button
        title="Clear badge"
        variant="ghost"
        onPress={() => badge.clear()}
        style={styles.clearBadge}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: { marginTop: 24, marginBottom: 12 },
  buttons: { gap: 8 },
  note: { marginTop: 16 },
  clearBadge: { marginTop: 8 },
});
