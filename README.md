# MobileAppBase

A production-grade React Native template to clone at the start of every project.

Bare React Native CLI (Swift + Kotlin native projects), TypeScript, three build
environments wired end to end, push notifications with action buttons, and
CI/CD that ships to both stores.

---

## Table of contents

- [What's in the box](#whats-in-the-box)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Starting a NEW project from this template](#starting-a-new-project-from-this-template)
- [Environments and flavors](#environments-and-flavors)
- [Project structure](#project-structure)
- [State management](#state-management)
- [Data fetching](#data-fetching)
- [Push notifications](#push-notifications)
- [Testing](#testing)
- [Debugging and profiling](#debugging-and-profiling)
- [CI/CD](#cicd)
- [Platform guides](#platform-guides)
- [Version policy and known constraints](#version-policy-and-known-constraints)

---

## What's in the box

| Concern | Choice | Why this one |
|---|---|---|
| Framework | React Native 0.86.2 (bare CLI) | Newest version with a fully compatible ecosystem. New Architecture + Hermes on. |
| Language | TypeScript 5.9.3, strict | `noUncheckedIndexedAccess` and `noImplicitOverride` on — see [version policy](#version-policy-and-known-constraints) for why not TS 7. |
| Navigation | React Navigation 7 (native stack + bottom tabs) | Native-thread transitions; typed routes; deep linking. |
| Client state | Zustand 5 (+ immer, persist) | No provider, selector-level subscriptions, usable outside React. |
| Server state | TanStack Query 5 + Axios | Cache, retry and refetch handled for you; mobile-tuned defaults. |
| Storage | MMKV 4 (fast KV) + Keychain (secrets) | Synchronous reads mean no auth flicker on launch. Tokens never touch MMKV. |
| Push | Firebase Messaging 26 + Notifee 9 | Notifee renders everything, so foreground/background look identical and action buttons work on both platforms. |
| Errors | Sentry 8 + error boundary | Per-environment DSN, noise filtered, PII scrubbed. |
| i18n | i18next 26 + react-native-localize | Device-locale detection with a persisted override. |
| Testing | Jest 29 + Testing Library 14 | Native modules mocked; unit + integration examples. |
| CI/CD | GitHub Actions + Fastlane | PR checks on Linux, signed store builds on macOS. |

---

## Requirements

| Tool | Version | Notes |
|---|---|---|
| Node | **≥ 22.11** | RN 0.86 requires it. `.nvmrc` pins 22.20.0 — run `nvm use`. |
| JDK | 17 | `brew install openjdk@17` |
| Ruby | ≥ 3.1 | For CocoaPods and Fastlane, via Bundler. |
| Xcode | 26.x | With an iOS 18+ simulator runtime. |
| Android SDK | API 36 | Set `ANDROID_HOME`, or let `android/local.properties` point at it. |
| Watchman | latest | `brew install watchman` |

---

## Quick start

```bash
nvm use && npm install && bundle install && npm run pods
```

Then run a dev build:

```bash
npm run ios:dev
```

```bash
npm run android:dev
```

The app boots into a login screen. **Any email plus a password of 8+ characters
signs you in** — there is no backend, so `authApi.login` falls back to a mock
when the API is unreachable (dev/staging only; see `src/features/auth/api/authApi.ts`).

> **CocoaPods on a path with spaces:** if `pod install` dies with
> `Unicode Normalization not appropriate for ASCII-8BIT`, your shell has no
> UTF-8 locale. Prefix with `LANG=en_US.UTF-8`, or add `export LANG=en_US.UTF-8`
> to your shell profile. The CI workflows already set it.

---

## Starting a NEW project from this template

Everything identity-related is centralized, so this is a small, mechanical change.

### 1. Edit one file

`app.identity.json` is the single source of truth for bundle id and app name:

```json
{
  "appId": "com.yourcompany.yourapp",
  "projectName": "MobileAppBase",
  "environments": {
    "dev":     { "appIdSuffix": ".dev",     "displayName": "YourApp Dev", "androidFlavor": "dev",     "iosScheme": "MobileAppBase-Dev" },
    "staging": { "appIdSuffix": ".staging", "displayName": "YourApp Stg", "androidFlavor": "staging", "iosScheme": "MobileAppBase-Staging" },
    "prod":    { "appIdSuffix": "",         "displayName": "YourApp",     "androidFlavor": "prod",    "iosScheme": "MobileAppBase" }
  }
}
```

```bash
npm run identity
```

That regenerates, in one pass:

- `ios/Config/{Debug,Release}-{Dev,Staging,Prod}.xcconfig` → `APP_BUNDLE_ID`, `APP_DISPLAY_NAME`
- `android/app/identity.gradle` → `applicationId`, product flavors, per-flavor `app_name`
- `src/config/identity.generated.ts` → typed values for the JS side

**`appId` and `displayName` are safe to change at any time.** Nothing else in the
repo hardcodes them.

### 2. `projectName` is a heavier change

`projectName` is the Xcode project/target/scheme name and the React Native app
key. Changing it means renaming the `.xcodeproj`, the target, the `ios/MobileAppBase/`
folder, `app.json`'s `name`, and `getMainComponentName()` in `MainActivity.kt`.

**Recommendation: leave `projectName` as `MobileAppBase` and just change `appId`
and `displayName`.** Users never see the project name — only the display name and
the bundle id, both of which are fully parameterized. Renaming buys you nothing
and risks a broken Xcode project.

If you do need it renamed, use [`react-native-rename`](https://github.com/junedomingo/react-native-rename),
then re-run `bundle exec ruby scripts/ios-setup-flavors.rb` and `npm run pods`.

### 3. Point at your own services

```bash
# API endpoints per environment
$EDITOR .env.dev .env.staging .env.prod

# Firebase (see docs/PUSH_NOTIFICATIONS.md)
android/app/src/{dev,staging,prod}/google-services.json
ios/Firebase/{dev,staging,prod}/GoogleService-Info.plist
```

### 4. Reset git history

```bash
rm -rf .git && git init -b main && git add -A && git commit -m "Initial commit from MobileAppBase"
```

### 5. Optional cleanup

`src/features/tasks/` is the Zustand teaching example. Delete the folder, its tab
entry in `src/navigation/MainTabNavigator.tsx`, and `__tests__/unit/taskStore.test.ts`
once you don't need it.

---

## Environments and flavors

Three environments exist on both platforms, installable **side by side** on one
device because each has its own bundle id.

| | dev | staging | prod |
|---|---|---|---|
| Bundle / applicationId | `com.mobileappbase.dev` | `com.mobileappbase.staging` | `com.mobileappbase` |
| Display name | AppBase Dev | AppBase Stg | AppBase |
| Env file | `.env.dev` | `.env.staging` | `.env.prod` |
| Android flavor | `dev` | `staging` | `prod` |
| iOS scheme | `MobileAppBase-Dev` | `MobileAppBase-Staging` | `MobileAppBase` |
| iOS configs | `Debug-Dev` / `Release-Dev` | `Debug-Staging` / `Release-Staging` | `Debug-Prod` / `Release-Prod` |

```bash
npm run ios:dev          npm run android:dev
npm run ios:staging      npm run android:staging
npm run ios:prod         npm run android:prod
```

### How a value reaches your code

`.env.<env>` → react-native-config bakes it into the binary at build time →
`src/config/env.ts` validates it and exposes a typed object:

```ts
import { env } from './src/config/env';

env.environment    // 'dev' | 'staging' | 'prod'
env.api.baseUrl    // validated, throws at startup if missing
env.appId          // com.mobileappbase.dev
env.isProd         // boolean
```

> **These values are not secret.** react-native-config compiles them into the
> binary; anyone can extract them from an `.ipa`/`.apk`. Put API *endpoints* and
> feature flags here — never API secrets or signing keys.

The Home tab renders all of them, which is the fastest way to confirm you built
the flavor you meant to.

---

## Project structure

```
src/
├── app/                      # Composition root
│   ├── App.tsx               #   providers, startup side effects
│   └── ErrorBoundary.tsx     #   theme-free fallback UI
├── config/
│   ├── env.ts                # validated build-time environment
│   └── identity.generated.ts # GENERATED — do not edit
├── components/               # Reusable, themed primitives
│   ├── Button.tsx  Screen.tsx  Text.tsx  TextField.tsx
├── features/                 # Feature-first: each owns its screens/store/api
│   ├── auth/     { api, hooks, screens, store }
│   ├── home/     { screens }
│   ├── notifications/ { screens }
│   ├── settings/ { screens }
│   └── tasks/    { screens, store }   ← Zustand reference example
├── navigation/
│   ├── RootNavigator.tsx     # auth vs app split
│   ├── AuthNavigator.tsx  MainTabNavigator.tsx
│   ├── linking.ts            # deep links + notification cold start
│   ├── navigationRef.ts      # imperative nav from outside React
│   └── types.ts              # typed param lists
├── services/                 # Cross-cutting, feature-agnostic
│   ├── api/      { client, errors, queryClient }
│   ├── storage/  { mmkv, secureStorage }
│   ├── notifications/ { pushService, categories }
│   ├── monitoring/ { sentry }
│   └── i18n/     { index, locales/ }
├── store/                    # Global (non-feature) Zustand stores
│   └── settingsStore.ts
├── theme/                    # tokens → themes → provider
└── types/
```

**The rule:** `features/` may import from `services/`, `components/`, `theme/`.
`services/` must never import from `features/`. That one constraint is what keeps
the dependency graph acyclic as the app grows.

---

## State management

Zustand, with a strict split:

> **Zustand = client state.** UI, local domain, ephemeral.
> **TanStack Query = server state.** Anything that came from an API.

Copying server data into Zustand means owning cache invalidation by hand, forever.

**Read [`src/features/tasks/store/taskStore.ts`](src/features/tasks/store/taskStore.ts) first** —
it's a heavily commented reference covering slices, immer, persist + migrations,
`useShallow` for derived data, action selectors, and non-React access.

The performance-critical part, in short:

```ts
// ✅ re-renders only when `filter` changes
const filter = useTaskStore((s) => s.filter);

// ❌ subscribes to the WHOLE store; re-renders on every unrelated change
const { filter } = useTaskStore();

// ✅ derived data returns a new reference each call — needs useShallow
const visible = useTaskStore(useShallow((s) => s.tasks.filter((t) => !t.completed)));
```

Reading or writing from a push handler or interceptor, where hooks don't exist:

```ts
useTaskStore.getState().addTask('from a notification');
```

### Alternatives considered

| | Verdict |
|---|---|
| **Redux Toolkit** | Better if you need time-travel devtools as a team norm or RTK Query's cache. Costs significant boilerplate; we use TanStack Query for server state anyway. |
| **Jotai / Recoil** | Excellent for fine-grained atomic state. Zustand's store-level model is easier for a team to navigate. |
| **Context + useReducer** | Fine for 2–3 values. Every consumer re-renders on any change, which bites by ~10. |

---

## Data fetching

`src/services/api/client.ts` is a single axios instance that:

1. Injects the access token on every request.
2. **Refreshes exactly once on a 401 and replays the queue.** Five concurrent
   401s trigger one refresh, not five — a naive implementation invalidates the
   refresh token four times and logs the user out.
3. Normalizes every failure into `ApiError` with a `kind` and a safe
   `userMessage`, so no screen writes `error?.response?.data?.message ?? ...`.

```ts
import { api } from './src/services/api/client';
const user = await api.get<User>('/users/me');   // returns data, throws ApiError
```

Query defaults (`queryClient.ts`) are mobile-tuned: 30s `staleTime`, refetch on
app foreground via `AppState`, exponential backoff, and **no retry on 4xx or on
mutations**. Query keys are centralized in `qk` so invalidation can't miss a typo.

---

## Push notifications

Full setup — APNs keys, Firebase projects, action buttons, payload format,
testing with `curl` — is in **[docs/PUSH_NOTIFICATIONS.md](docs/PUSH_NOTIFICATIONS.md)**.

The short version: the **Notifications tab has a button per category** that fires
a real local notification through the same code path as a remote push, so you can
verify action buttons without a backend.

Categories ship in `src/services/notifications/categories.ts`:

| Category | Buttons |
|---|---|
| `DEFAULT` | none |
| `INVITATION` | Accept / Decline |
| `REMINDER` | Mark done / Snooze 1h |
| `MESSAGE` | Reply (inline text input) |

> iOS looks category buttons up **locally** from what the app registered at
> startup — the payload only carries the id. A category the app never registered
> renders as a plain notification with no buttons. That is the single most common
> "my action buttons don't show" cause.

---

## Testing

```bash
npm test                 # all
npm run test:watch
npm run test:coverage
npm run validate         # typecheck + lint + test  ← run before pushing
```

34 tests across 4 suites: store logic, error normalization, secure storage, and
an integration test driving the real login screen against a mocked network.

`jest.setup.js` mocks every native module. Three things worth knowing if you add
libraries:

- **Don't mock `react-native-mmkv`.** v4 detects `JEST_WORKER_ID` and returns an
  in-memory instance itself. What *does* need mocking is `react-native-nitro-modules`,
  because MMKV reaches `TurboModuleRegistry.getEnforcing('NitroModules')` at import time.
- **Testing Library v14 is async.** `render`, `renderHook`, `fireEvent.*` and
  `act` all return promises. A non-awaited `act()` logs a warning that
  `jest.setup-after-env.js` deliberately escalates to a test failure.
- **Set `gcTime: 0`** on test QueryClients. The 5-minute default schedules a GC
  timer per settled mutation and Jest hangs with "did not exit one second after…".

---

## Debugging and profiling

| Task | Tool |
|---|---|
| General debugging | **React Native DevTools** — press `j` in the Metro terminal. The Chrome-debugger workflow is gone. |
| Component tree, props, re-renders | React DevTools (bundled in RN DevTools) |
| Network inspection | RN DevTools Network tab; on Android also `adb logcat` |
| Re-render hunting | `<Profiler>` or React Compiler's ESLint rules |
| Native iOS profiling | Xcode Instruments → Time Profiler / Allocations |
| Native Android profiling | Android Studio Profiler; `adb shell dumpsys gfxinfo <appId>` |
| Layout jank | Perf Monitor (Dev Menu → Show Perf Monitor) |
| Hermes bundle size | `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/main.jsbundle` then inspect |
| Crash triage | Sentry (per-environment DSN) |

Open the Dev Menu with `Cmd+D` (iOS sim), `Cmd+M` (Android emulator), or shake.

Performance choices already made: Hermes on, New Architecture on, FlashList
instead of FlatList, `React.memo` on list rows with store-stable handlers,
theme `StyleSheet`s memoized per theme, native-stack navigator (UI-thread
transitions), and Reanimated 4 worklets.

---

## CI/CD

### GitHub Actions

| Workflow | Trigger | Does |
|---|---|---|
| [`ci.yml`](.github/workflows/ci.yml) | PR / push to `main`,`develop` | typecheck, lint, test+coverage, Android debug APK, iOS simulator build |
| [`release.yml`](.github/workflows/release.yml) | tag `v*` or manual dispatch | signed builds → TestFlight + Play, dSYM upload |

Tag conventions: `v1.2.3` → prod, `v1.2.3-staging` → staging. Manual dispatch
lets you pick environment, platform, and Play track.

### Fastlane

```bash
bundle exec fastlane ios beta env:staging
bundle exec fastlane ios release env:prod
bundle exec fastlane android deploy env:prod track:internal
bundle exec fastlane android build_debug env:dev
```

Signing uses **fastlane match** (encrypted certs in a private git repo), readonly
on CI so a build can never revoke your team's certificates.

### Required secrets

<details>
<summary>GitHub Actions secrets (click to expand)</summary>

**Apple**
| Secret | How to get it |
|---|---|
| `APPLE_ID` | Your Apple Developer account email |
| `DEVELOPER_PORTAL_TEAM_ID` | developer.apple.com → Membership |
| `APP_STORE_CONNECT_TEAM_ID` | App Store Connect → Users and Access |
| `APP_STORE_CONNECT_API_KEY_ID` | ASC → Integrations → App Store Connect API |
| `APP_STORE_CONNECT_ISSUER_ID` | Same page |
| `APP_STORE_CONNECT_API_KEY` | `base64 -i AuthKey_XXX.p8` |
| `MATCH_GIT_URL` | Private repo holding encrypted certificates |
| `MATCH_PASSWORD` | Passphrase used by `match` |
| `MATCH_GIT_BASIC_AUTHORIZATION` | `echo -n "user:token" \| base64` |

**Android**
| Secret | How to get it |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -i release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD` | From keystore creation |
| `PLAY_STORE_JSON_KEY` | `base64` of the Play service-account JSON |

**Firebase / Sentry**
| Secret | Notes |
|---|---|
| `GOOGLE_SERVICES_JSON`, `GOOGLE_SERVICES_JSON_DEV` | base64 of `google-services.json` |
| `GOOGLE_SERVICE_PLIST`, `GOOGLE_SERVICE_PLIST_DEV` | base64 of `GoogleService-Info.plist` |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | For source map / dSYM upload |

</details>

---

## Platform guides

- **[docs/IOS_SETUP.md](docs/IOS_SETUP.md)** — certificates, provisioning profiles,
  APNs keys, capabilities, App Store review checklist.
- **[docs/ANDROID_SETUP.md](docs/ANDROID_SETUP.md)** — Gradle flavors, keystores,
  Play App Signing, target-API deadlines, Data Safety form.
- **[docs/PUSH_NOTIFICATIONS.md](docs/PUSH_NOTIFICATIONS.md)** — end-to-end push setup and testing.

---

## Version policy and known constraints

Versions here are pinned to the newest set that is **mutually compatible**, which
is not always the newest published:

- **React Native 0.86.2, not 0.87.** Reanimated's stable release declares
  `react-native: "0.83 - 0.86"`; only nightlies target 0.87. Upgrade once
  Reanimated 4.6 ships stable.
- **React 19.2.3**, the version RN 0.86.2 is tested against.
- **TypeScript 5.9.3, not 7.x.** TS 7 is the Go-native rewrite; RN's
  `@react-native/typescript-config`, babel and jest toolchain aren't validated
  against it yet.
- **Jest 29, not 30**, to match `@react-native/jest-preset@0.86.2`.

Two known upstream constraints, both already handled in this repo:

1. **`$RNFirebaseDisableSPM = true` in the Podfile.** react-native-firebase v26
   resolves Firebase through SPM by default, which collides with React Native's
   default static linkage. The alternative (`use_frameworks! :linkage => :dynamic`)
   converts every pod to a dynamic framework and hurts startup time. Note Firebase
   is [deprecating CocoaPods distribution after October 2026](https://firebase.google.com/docs/ios/cocoapods-deprecation);
   revisit then.
2. **Modular Firebase API only.** v26 removed the `messaging().getToken()`
   namespaced style. Use `getToken(getMessaging())`. Most tutorials online are
   still on the old API.

### Upgrading React Native

Use the [Upgrade Helper](https://react-native-community.github.io/upgrade-helper/)
diff, then re-run:

```bash
npm run identity && bundle exec ruby scripts/ios-setup-flavors.rb && npm run pods
```

Both scripts are idempotent and will re-apply the flavor configuration that an RN
upgrade may have overwritten.
