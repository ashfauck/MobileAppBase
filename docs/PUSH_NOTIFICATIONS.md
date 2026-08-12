# Push notifications

Firebase Cloud Messaging for transport, Notifee for display and interaction.

- [How the pieces fit](#how-the-pieces-fit)
- [Firebase setup](#firebase-setup)
- [iOS: APNs](#ios-apns)
- [Android specifics](#android-specifics)
- [Payload format](#payload-format)
- [Categories and action buttons](#categories-and-action-buttons)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## How the pieces fit

```
Your backend
   │  HTTP v1 API, data-only message
   ▼
FCM ──────────────► Android device
   │  (bridges to APNs)
   └───► APNs ────► iOS device
                       │
                       ▼
        ┌──────────────────────────────┐
        │ app foreground?              │
        │   onMessage()                │
        │ app background / killed?     │
        │   setBackgroundMessageHandler│
        └──────────────┬───────────────┘
                       ▼
              Notifee displayNotification()
                       │
              user taps / presses a button
                       ▼
        onForegroundEvent / onBackgroundEvent
                       ▼
              navigate() → deep link
```

**Why Notifee renders everything rather than letting FCM auto-display:**
FCM's own display only happens while backgrounded, produces no action buttons, and
looks different from a foreground notification you'd render yourself. Routing every
notification through Notifee means one code path, one appearance, and working
action buttons on both platforms.

Registration lives in two places, and both matter:

| File | Registers | Runs when |
|---|---|---|
| `index.js` | `setBackgroundMessageHandler`, `notifee.onBackgroundEvent` | Module scope — including the headless JS context used when the app is killed |
| `src/services/notifications/pushService.ts` → `initializeNotifications()` | channels, iOS categories, foreground listeners | App startup, from `App.tsx` |

> Background handlers **must** be registered at module scope in `index.js`.
> Registering them inside a component means they never run for a killed app, and
> notifications silently disappear.

---

## Firebase setup

Create **three** Firebase projects (or one project with three apps — separate
projects is cleaner because it keeps dev push traffic out of production analytics).

### Android

1. Firebase Console → Add app → Android.
2. Register all three package names:
   - `com.mobileappbase.dev`
   - `com.mobileappbase.staging`
   - `com.mobileappbase`
3. Download each `google-services.json` and place it at:

```
android/app/src/dev/google-services.json
android/app/src/staging/google-services.json
android/app/src/prod/google-services.json
```

Gradle picks the right one per flavor automatically. Until at least one exists,
`app/build.gradle` skips the Google Services plugin entirely and logs a notice —
so the template still builds before you've done any of this.

### iOS

1. Firebase Console → Add app → iOS, once per bundle id.
2. Download each `GoogleService-Info.plist` and place it at:

```
ios/Firebase/dev/GoogleService-Info.plist
ios/Firebase/staging/GoogleService-Info.plist
ios/Firebase/prod/GoogleService-Info.plist
```

The `[App] Copy Firebase config` build phase copies the right one into the `.app`
based on `APP_ENVIRONMENT` from the active xcconfig. It also **verifies the plist's
`BUNDLE_ID` matches the build's** and fails the build on a mismatch — otherwise
you get tokens for the wrong Firebase project, which is miserable to debug.

All of these files are git-ignored. Supply them to CI as base64 secrets (see the
README's secrets table).

---

## iOS: APNs

FCM cannot deliver to iOS without an APNs key.

### 1. Create an APNs auth key

developer.apple.com → Certificates, Identifiers & Profiles → **Keys** → `+`

- Name: `APNs Key`
- Enable **Apple Push Notifications service (APNs)**
- Download the `.p8` — **you can only download it once**
- Note the **Key ID** and your **Team ID**

> Prefer a `.p8` auth key over a `.p12` push certificate: one key works for every
> app in the team, covers both sandbox and production, and never expires.
> Certificates are per-app and expire annually.

### 2. Upload it to Firebase

Firebase Console → Project Settings → **Cloud Messaging** → iOS app →
APNs Authentication Key → Upload, with the Key ID and Team ID.

Repeat for each of the three Firebase projects (the same `.p8` can be reused).

### 3. Enable capabilities

In Xcode, for the `MobileAppBase` target → Signing & Capabilities:

- **Push Notifications**
- **Background Modes** → Remote notifications *(already declared in `Info.plist`)*

Each App ID in the Developer Portal must also have the Push Notifications
capability enabled.

### 4. What's already done for you

- `Info.plist` declares `UIBackgroundModes: [remote-notification, fetch]`.
- `AppDelegate.swift` calls `FirebaseApp.configure()` — guarded, so a missing
  plist logs instead of crashing.
- APNs delegate callbacks are **intentionally not implemented**;
  react-native-firebase swizzles them and forwards the APNs token to FCM.
  Implementing them yourself without forwarding is the most common cause of
  "the FCM token is never generated".

---

## Android specifics

**Runtime permission (Android 13+).** `POST_NOTIFICATIONS` is declared in the
manifest and requested at runtime by `requestNotificationPermission()`. Without
the runtime grant the user never sees a prompt and every push is dropped silently.

**Channels are immutable.** Once created, a channel's importance, sound and
vibration cannot be changed by an app update — the user owns them. To change
behaviour you must create a **new channel id**. Channels are defined in
`src/services/notifications/categories.ts`:

| id | Importance | Use |
|---|---|---|
| `default` | DEFAULT | General announcements |
| `reminders` | HIGH | Heads-up reminders, vibrates |
| `messages` | HIGH | DMs; `PRIVATE` visibility hides content on the lock screen |
| `silent` | LOW | Background updates, no sound |

**Manifest merge.** `react-native-firebase_messaging` declares
`default_notification_channel_id` with an empty value, so our manifest carries
`tools:replace="android:value"`. Removing it fails the build.

---

## Payload format

Send **data-only** messages. If you include a `notification` block, Android's FCM
SDK renders it itself while the app is backgrounded and the user sees **two**
notifications.

```json
{
  "message": {
    "token": "<device fcm token>",
    "data": {
      "title": "Task reminder",
      "body": "Ship the release build",
      "category": "REMINDER",
      "deepLink": "mobileappbase://notifications/task_123",
      "entityId": "task_123"
    },
    "apns": {
      "headers": { "apns-priority": "5" },
      "payload": { "aps": { "content-available": 1, "mutable-content": 1 } }
    },
    "android": { "priority": "high" }
  }
}
```

| Field | Meaning |
|---|---|
| `title` / `body` | Displayed text |
| `category` | Must be one of `DEFAULT`, `INVITATION`, `REMINDER`, `MESSAGE` |
| `deepLink` | Where a tap navigates; handled by `src/navigation/linking.ts` |
| `entityId` | Your domain id, echoed back to the action handlers |

All FCM `data` values must be **strings** — numbers and booleans are rejected.

---

## Categories and action buttons

Defined once in `src/services/notifications/categories.ts` and mapped to both
platforms.

| Category | Buttons | Action ids |
|---|---|---|
| `DEFAULT` | — | — |
| `INVITATION` | Accept / Decline | `accept`, `decline` |
| `REMINDER` | Mark done / Snooze 1h | `complete`, `snooze` |
| `MESSAGE` | Reply (inline input) | `reply` |

**iOS:** buttons come from a category registered with the OS at startup
(`notifee.setNotificationCategories`). The payload carries only the category id;
iOS looks the buttons up locally. **A category the app never registered renders
with no buttons.**

**Android:** buttons are attached to each notification at display time, and every
notification needs a channel.

Handle a press in `handleNotificationEvent()` in `pushService.ts`. Note it may run
with the app **killed**, so it must not depend on React state — use
`useSomeStore.getState()` or call your API directly.

### Adding a category

1. Add the id to `NOTIFICATION_CATEGORIES` and any new ids to `NOTIFICATION_ACTIONS`.
2. Add an entry to `iosCategories`.
3. Add a `case` to `androidConfigForCategory()`.
4. Handle the new action ids in `handleNotificationEvent()`.
5. Tell your backend the new `category` value.

---

## Testing

### Local notifications (no backend)

Open the **Notifications tab** and press any category button. These go through the
same `displayNotification()` as remote pushes, so action buttons behave identically.

> On iOS, background the app (or pull the banner down) to see action buttons — a
> foreground banner doesn't expand.

### Remote push

1. Run on a **physical iOS device**. The iOS Simulator cannot receive remote FCM
   pushes. Android emulators with Google Play services can.
2. Grant permission, then copy the token from the Notifications tab.
3. Send one:

```bash
curl -X POST "https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "PASTE_DEVICE_TOKEN",
      "data": {
        "title": "Reminder",
        "body": "Action buttons should appear here",
        "category": "REMINDER",
        "entityId": "task_123"
      },
      "apns": { "headers": { "apns-priority": "5" },
                "payload": { "aps": { "content-available": 1 } } },
      "android": { "priority": "high" }
    }
  }'
```

Test all three app states — foreground, background, and **force-quit** — because
they run through three different handlers.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `getFcmToken()` returns null on iOS | No APNs key uploaded to Firebase, or permission not granted yet, or running on the Simulator. |
| Token generated, no notification arrives | Bundle id in `GoogleService-Info.plist` doesn't match the build. The build phase now fails loudly on this. |
| No action buttons on iOS | Category not registered at startup, or the payload's `category` doesn't match an id in `iosCategories`. |
| No action buttons on Android | Notification sent without a channel, or the channel was created before the actions were added — reinstall the app. |
| Two notifications on Android | Payload included a `notification` block. Send data-only. |
| Nothing arrives when force-quit | Handlers not at module scope in `index.js`, or (Android) the OEM battery optimizer is killing the app — check Xiaomi/Huawei/Oppo settings. |
| Works in debug, not release | ProGuard stripping. Rules ship with the libraries; verify `android/app/proguard-rules.pro` wasn't emptied. |
| `FirebaseApp is not initialized` | `GoogleService-Info.plist` / `google-services.json` missing for that flavor. |
| Android 13 device never prompts | `POST_NOTIFICATIONS` not requested at runtime. |
