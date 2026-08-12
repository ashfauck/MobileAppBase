# Architecture decisions

Why the template is shaped the way it is. Read this before making structural
changes — most of these choices have a non-obvious failure mode behind them.

---

## Feature-first, not layer-first

```
src/features/auth/{api,hooks,screens,store}     ✅
src/{screens,stores,api}/auth*                  ❌
```

Layer-first directories (`screens/`, `stores/`, `api/`) look tidy at 5 screens
and become unnavigable at 50: every change touches four distant folders, and
nothing tells you which files belong together. Feature-first keeps a change
local, and makes deleting a feature a single `rm -rf`.

### The one hard rule

```
features/  →  services/, components/, theme/, navigation/types
navigation/ →  features/          (its whole job is wiring screens in)
services/  →  ✗ features/         (never)
components/→  ✗ features/         (never)
theme/     →  ✗ features/         (never)
```

This is enforced by `no-restricted-imports` in `.eslintrc.js`, not just
documented. A `services/` file importing from `features/` creates a cycle that
breaks Jest module resolution and Metro's bundling in confusing ways.

If a feature needs something shared, move it *down* into `services/` or
`components/` — never reach sideways.

---

## Two kinds of state, deliberately separated

| | Owner | Examples |
|---|---|---|
| **Server state** | TanStack Query | user profile, lists, anything fetched |
| **Client state** | Zustand | theme, filters, drafts, session status |

The failure mode this avoids: fetching into Zustand means you now own caching,
deduplication, background refetch, stale invalidation and retry — by hand,
forever. TanStack Query exists to own that. Zustand owns only what the server
has no opinion about.

The auth store is the deliberate seam: it holds `status` and a cached `user`
(client state, needed synchronously at launch to pick a navigator), while the
authoritative profile comes from a query.

---

## Tokens in Keychain, everything else in MMKV

`secureStorage.ts` stores both tokens as **one JSON blob under one key**, rather
than two entries. Two separate Keychain writes can partially fail, leaving an
access token with a mismatched refresh token — a state that looks valid and fails
mysteriously an hour later.

Every Keychain call is wrapped and degrades to `null`. Keychain genuinely throws
on real devices: no passcode set, entry invalidated by a biometric change, or an
OS restore from another device. A forced re-login is a far better outcome than a
crash on launch.

MMKV is used for everything else because it is **synchronous**. That's what makes
Zustand's `persist` rehydrate during the first render, so there's no flash of the
login screen before the stored session loads. AsyncStorage would require an async
bootstrap and a loading state.

Instances are namespaced by environment (`app-storage-dev`), so a dev build can't
read or corrupt a production build's cache on the same device.

---

## Single-flight token refresh

The most important 30 lines in the codebase (`services/api/client.ts`):

```
5 requests fire → all get 401
  naive:  5 refresh calls → backend rotates the refresh token 5 times
          → 4 are now invalid → user is logged out
  here:   1 refresh promise, 4 requests await it, all 5 replay
```

`config._retried` guarantees a request is retried at most once, so a genuinely
dead session terminates instead of looping forever.

---

## Conditional navigators, not imperative auth navigation

```tsx
{status === 'authenticated'
  ? <Stack.Screen name="Main" ... />
  : <Stack.Screen name="Auth" ... />}
```

Rendering one stack *or* the other — rather than `navigate('Login')` on logout —
means there is physically no back-navigation from the app into the login screen,
and no authenticated screen survives a sign-out holding stale data. React
Navigation unmounts the whole subtree.

---

## navigationRef with a pending buffer

A notification tap on a **killed** app runs the handler before
`NavigationContainer` mounts. Calling `navigate()` then is a silent no-op — the
classic "deep links work when the app is open, do nothing when it's closed" bug.

`navigationRef.ts` buffers the intent and `RootNavigator`'s `onReady` flushes it.

---

## Notifee renders every notification

FCM's built-in display only fires when backgrounded, has no action buttons, and
looks different from anything you'd render in the foreground. Routing everything
through `displayNotification()` gives one code path, one appearance, and working
categories on both platforms — at the cost of sending data-only payloads.

---

## Generated identity files are committed

`ios/Config/*.xcconfig`, `android/app/identity.gradle` and
`src/config/identity.generated.ts` are generated **and** committed.

They're referenced by `project.pbxproj` and imported by TypeScript, so a fresh
clone must have them before anyone runs `npm install`. `postinstall` keeps them
in sync, and a stray diff in a PR is a useful signal that someone edited a
generated file by hand.

---

## Scripted native configuration

Xcode build configurations and schemes are created by
`scripts/ios-setup-flavors.rb` (via the `xcodeproj` gem) rather than clicked
together in Xcode. Android flavors are generated into `identity.gradle`.

Both are idempotent, which matters most during a React Native upgrade: the
upgrade rewrites `project.pbxproj`, and one command puts the flavor setup back.
Hand-configured Xcode projects are the single biggest source of "the upgrade
broke our build" pain.

---

## Things deliberately NOT included

| Omitted | Why |
|---|---|
| Path aliases (`@/components`) | Needs babel + metro + tsconfig kept in sync; three places to break for cosmetic gain. Relative imports always work. Add `babel-plugin-module-resolver` if you want them. |
| A UI component library | Every project wants a different one, and ripping one out is worse than adding one. Four themed primitives are provided instead. |
| Form library | React Hook Form is excellent but not always needed; the login screen shows the plain-state pattern. Add it when a form justifies it. |
| Redux Toolkit | See the README comparison. Zustand + TanStack Query covers the same ground with far less ceremony. |
| Code push / OTA | Microsoft retired App Center; the replacements (Expo Updates, Sentry, self-hosted) are a real decision, not a default. |
| Detox / Maestro E2E | Heavy CI setup and a real maintenance burden. The integration test covers the auth flow; add E2E when you have flows worth the cost. |
