/**
 * Push notifications: FCM for transport, Notifee for display and interaction.
 *
 * ── Why both libraries ────────────────────────────────────────────────────
 * FCM delivers the payload (and on iOS bridges to APNs). Its own auto-display
 * only runs when the app is backgrounded, produces no action buttons, and looks
 * different from anything you render yourself. Notifee takes over display
 * entirely, so foreground and background notifications are identical and
 * categories/actions work on both platforms.
 *
 * ── Expected payload from your backend ────────────────────────────────────
 * Send a DATA-ONLY message (no `notification` key). If you include
 * `notification`, Android's FCM SDK renders it itself while backgrounded and
 * you get two notifications.
 *
 *   {
 *     "token": "<device fcm token>",
 *     "data": {
 *       "title":    "Task reminder",
 *       "body":     "Ship the release build",
 *       "category": "REMINDER",             // must exist in categories.ts
 *       "deepLink": "mobileappbase://tasks",
 *       "entityId": "task_123"
 *     },
 *     "apns": {
 *       "payload": { "aps": { "content-available": 1, "mutable-content": 1 } },
 *       "headers": { "apns-priority": "5" }
 *     },
 *     "android": { "priority": "high" }
 *   }
 * ─────────────────────────────────────────────────────────────────────────
 */
import { Platform } from 'react-native';
// react-native-firebase v26 is modular-only: the old default-export namespace
// (`messaging().getToken()`) was removed. Every call now takes the Messaging
// instance returned by getMessaging() as its first argument.
import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh as onTokenRefreshListener,
  registerDeviceForRemoteMessages,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  EventType,
  TriggerType,
  type Event as NotifeeEvent,
  type TimestampTrigger,
} from '@notifee/react-native';

import { env } from '../../config/env';
import { navigate } from '../../navigation/navigationRef';
import {
  ANDROID_CHANNELS,
  NOTIFICATION_ACTIONS,
  NOTIFICATION_CATEGORIES,
  androidChannels,
  androidConfigForCategory,
  iosCategories,
  type NotificationCategoryId,
} from './categories';

/** The shape we require in `message.data`. All FCM data values are strings. */
export type PushPayload = {
  title?: string;
  body?: string;
  category?: string;
  deepLink?: string;
  entityId?: string;
};

let initialized = false;

/* ------------------------------------------------------------ permissions --- */

export type PermissionResult = 'granted' | 'denied' | 'provisional' | 'unavailable';

/**
 * Requests notification permission.
 *
 * Ask this at a moment the user understands WHY — after they enable reminders,
 * not on first launch. iOS only ever shows the system prompt once; a denial is
 * permanent until the user changes it in Settings.
 */
export async function requestNotificationPermission(): Promise<PermissionResult> {
  // Notifee handles both platforms, including the Android 13+
  // POST_NOTIFICATIONS runtime permission.
  const settings = await notifee.requestPermission({
    // iOS: lets the notification appear in Notification Center silently without
    // a prompt. Users can then promote it. Set to false if you want the
    // classic blocking prompt.
    provisional: false,
  });

  switch (settings.authorizationStatus) {
    case AuthorizationStatus.AUTHORIZED:
      return 'granted';
    case AuthorizationStatus.PROVISIONAL:
      return 'provisional';
    case AuthorizationStatus.DENIED:
      return 'denied';
    default:
      return 'unavailable';
  }
}

export async function getPermissionStatus(): Promise<PermissionResult> {
  const settings = await notifee.getNotificationSettings();
  switch (settings.authorizationStatus) {
    case AuthorizationStatus.AUTHORIZED:
      return 'granted';
    case AuthorizationStatus.PROVISIONAL:
      return 'provisional';
    case AuthorizationStatus.DENIED:
      return 'denied';
    default:
      return 'unavailable';
  }
}

/* ----------------------------------------------------------------- token --- */

/**
 * Current FCM registration token, or null when unavailable.
 *
 * On iOS the APNs token must arrive before FCM can mint one. react-native-firebase
 * handles the handshake, but calling getToken() before permission is granted
 * returns null — so always request permission first.
 */
export async function getFcmToken(): Promise<string | null> {
  try {
    const messaging = getMessaging();

    if (Platform.OS === 'ios') {
      // No-op if already registered; required on a simulator that never
      // auto-registers for remote notifications.
      await registerDeviceForRemoteMessages(messaging);
    }
    const token = await getToken(messaging);
    return token || null;
  } catch (error) {
    console.warn('[push] Failed to get FCM token', error);
    return null;
  }
}

/**
 * Tokens rotate (app restore, reinstall, ~monthly). Send every new one to your
 * backend or pushes silently stop arriving.
 */
export function onTokenRefresh(handler: (token: string) => void): () => void {
  return onTokenRefreshListener(getMessaging(), handler);
}

/* --------------------------------------------------------------- display --- */

function parsePayload(message: RemoteMessage): PushPayload {
  const data = (message.data ?? {}) as Record<string, unknown>;
  const asString = (v: unknown) => (typeof v === 'string' ? v : undefined);

  return {
    title: asString(data.title) ?? message.notification?.title,
    body: asString(data.body) ?? message.notification?.body,
    category: asString(data.category),
    deepLink: asString(data.deepLink),
    entityId: asString(data.entityId),
  };
}

function resolveCategory(raw?: string): NotificationCategoryId {
  const valid = Object.values(NOTIFICATION_CATEGORIES) as string[];
  return valid.includes(raw ?? '')
    ? (raw as NotificationCategoryId)
    : NOTIFICATION_CATEGORIES.DEFAULT;
}

/**
 * Renders a notification with the right buttons for its category.
 * Used for incoming pushes AND for the local test notifications on the demo screen.
 */
export async function displayNotification(payload: PushPayload): Promise<void> {
  const category = resolveCategory(payload.category);
  const android = androidConfigForCategory(category);

  await notifee.displayNotification({
    title: payload.title ?? 'Notification',
    body: payload.body ?? '',
    // Carried through to the event handlers when a button is pressed.
    data: {
      category,
      deepLink: payload.deepLink ?? '',
      entityId: payload.entityId ?? '',
    },

    android: {
      channelId: android.channelId,
      // Must exist in android/app/src/main/res/drawable. Falls back to the
      // launcher icon (which Android renders as a white square) if missing.
      smallIcon: 'ic_launcher',
      importance: AndroidImportance.HIGH,
      actions: android.actions,
      pressAction: { id: NOTIFICATION_ACTIONS.PRESS, launchActivity: 'default' },
      // Dismiss when tapped rather than sticking around.
      autoCancel: true,
    },

    ios: {
      // THE key line: this is what makes iOS attach the action buttons that
      // were registered for this category at startup.
      categoryId: category,
      sound: 'default',
      // Show the banner even while the app is in the foreground (iOS 14+).
      foregroundPresentationOptions: {
        banner: true,
        list: true,
        sound: true,
        badge: true,
      },
    },
  });
}

/* ---------------------------------------------------------- interactions --- */

/**
 * Shared handling for a notification press or action-button press.
 *
 * Exported because the background handler in index.js needs the exact same
 * logic, and duplicating it is how the two paths drift apart.
 */
export async function handleNotificationEvent(event: NotifeeEvent): Promise<void> {
  const { type, detail } = event;
  const notification = detail.notification;
  const actionId = detail.pressAction?.id;
  const data = (notification?.data ?? {}) as Record<string, string>;

  // DISMISSED and DELIVERED carry no user intent.
  if (type !== EventType.PRESS && type !== EventType.ACTION_PRESS) return;

  switch (actionId) {
    case NOTIFICATION_ACTIONS.ACCEPT:
      // TODO: call your API here. Note this may run with the app in the
      // background, so it must not depend on React state.
      console.info('[push] Invitation accepted', data.entityId);
      break;

    case NOTIFICATION_ACTIONS.DECLINE:
      console.info('[push] Invitation declined', data.entityId);
      break;

    case NOTIFICATION_ACTIONS.COMPLETE:
      console.info('[push] Reminder completed', data.entityId);
      break;

    case NOTIFICATION_ACTIONS.SNOOZE: {
      // Re-deliver in an hour using a trigger notification.
      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: Date.now() + 60 * 60 * 1000,
      };
      await notifee.createTriggerNotification(
        {
          title: notification?.title,
          body: notification?.body,
          android: {
            channelId: ANDROID_CHANNELS.REMINDERS,
            // Android silently drops a notification with no small icon.
            smallIcon: 'ic_launcher',
            pressAction: { id: NOTIFICATION_ACTIONS.PRESS, launchActivity: 'default' },
          },
          ios: { categoryId: NOTIFICATION_CATEGORIES.REMINDER },
          data,
        },
        trigger,
      );
      break;
    }

    case NOTIFICATION_ACTIONS.REPLY: {
      // Inline reply text arrives on detail.input.
      const reply = detail.input;
      console.info('[push] Reply sent', { entityId: data.entityId, reply });
      break;
    }

    default:
      break;
  }

  // Any press that should open a screen.
  const shouldOpenApp =
    type === EventType.PRESS ||
    actionId === NOTIFICATION_ACTIONS.ACCEPT ||
    actionId === NOTIFICATION_ACTIONS.REPLY;

  if (shouldOpenApp && data.entityId) {
    // navigate() buffers the intent if the navigator isn't mounted yet
    // (cold start from a notification tap).
    navigate('NotificationDetail', { notificationId: data.entityId });
  }

  // Clear the notification so the tray doesn't accumulate stale entries.
  if (notification?.id) {
    await notifee.cancelNotification(notification.id);
  }
}

/* ------------------------------------------------------------------ init --- */

/**
 * Registers channels, categories and foreground listeners.
 * Call once from the app root. Returns a cleanup function.
 */
export async function initializeNotifications(): Promise<() => void> {
  if (initialized) return () => {};
  initialized = true;

  // Android: channels must exist before any notification referencing them.
  if (Platform.OS === 'android') {
    await Promise.all(androidChannels.map((channel) => notifee.createChannel(channel)));
  }

  // iOS: categories must be registered before a push carrying that category
  // arrives, otherwise the buttons simply don't render.
  if (Platform.OS === 'ios') {
    await notifee.setNotificationCategories([...iosCategories]);
  }

  const unsubscribers: (() => void)[] = [];

  // Foreground push -> render it ourselves.
  unsubscribers.push(
    onMessage(getMessaging(), async (message: RemoteMessage) => {
      if (env.isDev) console.info('[push] Foreground message', message.messageId);
      await displayNotification(parsePayload(message));
    }),
  );

  // Foreground taps and action-button presses.
  unsubscribers.push(notifee.onForegroundEvent(handleNotificationEvent));

  return () => {
    unsubscribers.forEach((fn) => fn());
    initialized = false;
  };
}

/** Exposed so index.js can register the background handlers. */
export const backgroundHandlers = {
  /** Data-only messages received while backgrounded / killed. */
  onBackgroundMessage: async (message: RemoteMessage) => {
    await displayNotification(parsePayload(message));
  },
  /** Button presses on a notification while backgrounded / killed. */
  onBackgroundEvent: handleNotificationEvent,
};

/** Badge helpers — iOS shows a count, Android shows a dot on most launchers. */
export const badge = {
  set: (count: number) => notifee.setBadgeCount(Math.max(0, count)),
  clear: () => notifee.setBadgeCount(0),
};
