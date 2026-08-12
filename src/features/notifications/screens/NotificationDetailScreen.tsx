import React from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import type { RootScreenProps } from '../../../navigation/types';

/**
 * Target of the deep link `mobileappbase://notifications/:notificationId`.
 * Reaching this screen from a cold start proves the whole chain works:
 * push tap -> background handler -> navigationRef buffer -> linking config.
 */
export default function NotificationDetailScreen({
  route,
  navigation,
}: RootScreenProps<'NotificationDetail'>) {
  const { t } = useTranslation();
  const { notificationId } = route.params;

  return (
    <Screen contentContainerStyle={styles.content}>
      <Text variant="title">{t('notifications.detailTitle', { id: notificationId })}</Text>
      <Text tone="secondary">
        You arrived here from a notification. The id was carried through the push payload's
        `entityId` field.
      </Text>
      <Button title={t('common.ok')} onPress={() => navigation.goBack()} fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', gap: 16 },
});
