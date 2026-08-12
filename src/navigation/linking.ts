/**
 * Deep link configuration.
 *
 * Keep this in sync with:
 *   - ios/MobileAppBase/Info.plist  -> CFBundleURLSchemes
 *   - android/app/src/main/AndroidManifest.xml -> intent-filter data
 *
 * Notification payloads carry a `deepLink` field (see the push service), which
 * lets the backend route a tap to any screen without an app release.
 */
import { Linking } from 'react-native';
import type { LinkingOptions } from '@react-navigation/native';
import {
  getInitialNotification,
  getMessaging,
  onNotificationOpenedApp,
  type RemoteMessage,
} from '@react-native-firebase/messaging';

import type { RootStackParamList } from './types';

export const URL_SCHEME = 'mobileappbase';
export const UNIVERSAL_LINK_HOST = 'https://example.com/app';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [`${URL_SCHEME}://`, UNIVERSAL_LINK_HOST],

  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          ForgotPassword: 'forgot-password',
        },
      },
      Main: {
        screens: {
          Home: 'home',
          Tasks: 'tasks',
          Notifications: 'notifications',
          Settings: 'settings',
        },
      },
      NotificationDetail: 'notifications/:notificationId',
    },
  },

  /**
   * Cold start from a notification.
   *
   * React Navigation only checks Linking.getInitialURL() by default, which is
   * empty when the app was opened by tapping a *notification* rather than a
   * link. getInitialNotification() covers that case.
   */
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url) return url;

    try {
      const initialNotification = await getInitialNotification(getMessaging());
      const deepLink = initialNotification?.data?.deepLink;
      if (typeof deepLink === 'string') return deepLink;
    } catch {
      // Firebase not configured — deep links via notifications simply won't fire.
    }

    return null;
  },

  /**
   * Warm start: the app was backgrounded and the user tapped a notification.
   */
  subscribe(listener) {
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => listener(url));

    let unsubscribeNotification: (() => void) | undefined;
    try {
      unsubscribeNotification = onNotificationOpenedApp(getMessaging(), (message: RemoteMessage) => {
        const deepLink = message?.data?.deepLink;
        if (typeof deepLink === 'string') listener(deepLink);
      });
    } catch {
      // Firebase not configured.
    }

    return () => {
      linkingSubscription.remove();
      unsubscribeNotification?.();
    };
  },
};
