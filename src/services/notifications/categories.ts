/**
 * Notification categories and action buttons.
 *
 * ── How the two platforms differ ──────────────────────────────────────────
 * iOS   Buttons come from a *category* registered with the OS at startup. The
 *       push payload only carries the category id in `aps.category`; iOS looks
 *       up the buttons locally. A category id the app never registered shows a
 *       plain notification with no buttons — the single most common bug here.
 *
 * Android  Buttons are attached to the *notification itself* at display time,
 *       and every notification must belong to a channel. Channel settings
 *       (importance, sound, vibration) are immutable after first creation:
 *       to change them you must use a new channel id or reinstall.
 *
 * Notifee papers over most of the difference, but the ids below must match what
 * your backend sends, so keep this file and the server in sync.
 * ─────────────────────────────────────────────────────────────────────────
 */
import {
  AndroidImportance,
  AndroidVisibility,
  type AndroidAction,
  type AndroidChannel,
  type IOSNotificationCategory,
} from '@notifee/react-native';

/** iOS category ids == the value your server puts in `aps.category`. */
export const NOTIFICATION_CATEGORIES = {
  /** Plain informational message, no buttons. */
  DEFAULT: 'DEFAULT',
  /** Accept / Decline — e.g. an invitation. */
  INVITATION: 'INVITATION',
  /** Mark as done / Snooze — e.g. a task reminder. */
  REMINDER: 'REMINDER',
  /** Inline reply — e.g. a chat message. */
  MESSAGE: 'MESSAGE',
} as const;

export type NotificationCategoryId =
  (typeof NOTIFICATION_CATEGORIES)[keyof typeof NOTIFICATION_CATEGORIES];

/** Action ids reported back to us when a button is pressed. */
export const NOTIFICATION_ACTIONS = {
  ACCEPT: 'accept',
  DECLINE: 'decline',
  COMPLETE: 'complete',
  SNOOZE: 'snooze',
  REPLY: 'reply',
  /** Notifee's id for "the notification body itself was tapped". */
  PRESS: 'default',
} as const;

export type NotificationActionId =
  (typeof NOTIFICATION_ACTIONS)[keyof typeof NOTIFICATION_ACTIONS];

/* ------------------------------------------------------------------ iOS --- */

/**
 * Passed to notifee.setNotificationCategories() once at startup.
 *
 * `foreground: true` brings the app to the front when pressed; `false` runs the
 * action in the background with the notification dismissed. `destructive`
 * renders the title in red, `authenticationRequired` forces device unlock first.
 */
export const iosCategories: IOSNotificationCategory[] = [
  {
    id: NOTIFICATION_CATEGORIES.DEFAULT,
    actions: [],
  },
  {
    id: NOTIFICATION_CATEGORIES.INVITATION,
    actions: [
      {
        id: NOTIFICATION_ACTIONS.ACCEPT,
        title: 'Accept',
        foreground: true,
      },
      {
        id: NOTIFICATION_ACTIONS.DECLINE,
        title: 'Decline',
        destructive: true,
      },
    ],
  },
  {
    id: NOTIFICATION_CATEGORIES.REMINDER,
    actions: [
      {
        id: NOTIFICATION_ACTIONS.COMPLETE,
        title: 'Mark done',
      },
      {
        id: NOTIFICATION_ACTIONS.SNOOZE,
        title: 'Snooze 1h',
      },
    ],
  },
  {
    id: NOTIFICATION_CATEGORIES.MESSAGE,
    actions: [
      {
        id: NOTIFICATION_ACTIONS.REPLY,
        title: 'Reply',
        // Renders the native inline text field on the notification.
        input: {
          placeholderText: 'Message…',
          buttonText: 'Send',
        },
      },
    ],
  },
];

/* -------------------------------------------------------------- Android --- */

export const ANDROID_CHANNELS = {
  DEFAULT: 'default',
  REMINDERS: 'reminders',
  MESSAGES: 'messages',
  SILENT: 'silent',
} as const;

export type AndroidChannelId = (typeof ANDROID_CHANNELS)[keyof typeof ANDROID_CHANNELS];

export const androidChannels: AndroidChannel[] = [
  {
    id: ANDROID_CHANNELS.DEFAULT,
    name: 'General',
    description: 'App updates and general announcements',
    importance: AndroidImportance.DEFAULT,
  },
  {
    id: ANDROID_CHANNELS.REMINDERS,
    name: 'Reminders',
    description: 'Task and event reminders',
    // HIGH pops a heads-up notification over the current screen.
    importance: AndroidImportance.HIGH,
    vibration: true,
  },
  {
    id: ANDROID_CHANNELS.MESSAGES,
    name: 'Messages',
    description: 'Direct messages',
    importance: AndroidImportance.HIGH,
    vibration: true,
    // Hide message content on the lock screen.
    visibility: AndroidVisibility.PRIVATE,
  },
  {
    id: ANDROID_CHANNELS.SILENT,
    name: 'Background updates',
    description: 'Silent updates with no sound or vibration',
    importance: AndroidImportance.LOW,
  },
] as const;

/**
 * Maps an iOS category to the Android buttons + channel that produce the same
 * user-visible notification, so the backend only has to send one `category`
 * field for both platforms.
 */
export function androidConfigForCategory(category: NotificationCategoryId): {
  channelId: AndroidChannelId;
  actions: AndroidAction[];
} {
  switch (category) {
    case NOTIFICATION_CATEGORIES.INVITATION:
      return {
        channelId: ANDROID_CHANNELS.DEFAULT,
        actions: [
          { title: 'Accept', pressAction: { id: NOTIFICATION_ACTIONS.ACCEPT } },
          { title: 'Decline', pressAction: { id: NOTIFICATION_ACTIONS.DECLINE } },
        ],
      };

    case NOTIFICATION_CATEGORIES.REMINDER:
      return {
        channelId: ANDROID_CHANNELS.REMINDERS,
        actions: [
          { title: 'Mark done', pressAction: { id: NOTIFICATION_ACTIONS.COMPLETE } },
          { title: 'Snooze 1h', pressAction: { id: NOTIFICATION_ACTIONS.SNOOZE } },
        ],
      };

    case NOTIFICATION_CATEGORIES.MESSAGE:
      return {
        channelId: ANDROID_CHANNELS.MESSAGES,
        actions: [
          {
            title: 'Reply',
            pressAction: { id: NOTIFICATION_ACTIONS.REPLY },
            // `true` renders the inline remote-input field (Android 7+).
            // Note notifee types this as `true | AndroidInput`, never `false` —
            // omit the key entirely for a plain button.
            input: true as const,
          },
        ],
      };

    default:
      return { channelId: ANDROID_CHANNELS.DEFAULT, actions: [] };
  }
}
