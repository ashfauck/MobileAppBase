# iOS setup, signing, and App Store compliance

- [Build configurations and schemes](#build-configurations-and-schemes)
- [Certificates and provisioning](#certificates-and-provisioning)
- [Capabilities](#capabilities)
- [App Store submission checklist](#app-store-submission-checklist)
- [Common build failures](#common-build-failures)

---

## Build configurations and schemes

This project has **six** build configurations, not the usual two:

| Scheme | Debug config | Release config | Bundle id |
|---|---|---|---|
| `MobileAppBase-Dev` | `Debug-Dev` | `Release-Dev` | `com.mobileappbase.dev` |
| `MobileAppBase-Staging` | `Debug-Staging` | `Release-Staging` | `com.mobileappbase.staging` |
| `MobileAppBase` | `Debug-Prod` | `Release-Prod` | `com.mobileappbase` |

Each configuration's base xcconfig is `ios/Config/<Configuration>.xcconfig`,
generated from `app.identity.json`. Each of those `#include?`s the matching
CocoaPods xcconfig, so Pods settings still apply:

```
// ios/Config/Debug-Dev.xcconfig  (generated)
#include? "Pods/Target Support Files/Pods-MobileAppBase/Pods-MobileAppBase.debug-dev.xcconfig"

APP_BUNDLE_ID    = com.mobileappbase.dev
APP_DISPLAY_NAME = AppBase Dev
APP_ENVIRONMENT  = dev
ENVFILE          = .env.dev
```

`PRODUCT_BUNDLE_IDENTIFIER` in the project is literally `$(APP_BUNDLE_ID)`, and
`Info.plist`'s `CFBundleDisplayName` is `$(APP_DISPLAY_NAME)` — so the pbxproj
itself is flavor-agnostic and nothing needs editing per environment.

### Regenerating

Xcode configuration is scripted, so an RN upgrade that rewrites the project can
be repaired in one command:

```bash
bundle exec ruby scripts/ios-setup-flavors.rb && npm run pods
```

Both scripts are idempotent.

> **Always open `ios/MobileAppBase.xcworkspace`, never the `.xcodeproj`.**
> The `.xcodeproj` alone doesn't include Pods and won't link.

---

## Certificates and provisioning

### Recommended: fastlane match

Certificates and profiles are stored encrypted in a private git repo, so every
developer and CI runner uses the same identity.

One-time setup, by one person:

```bash
bundle exec fastlane match init
```

```bash
bundle exec fastlane match development --app_identifier "com.mobileappbase.dev,com.mobileappbase.staging,com.mobileappbase"
```

```bash
bundle exec fastlane match appstore --app_identifier "com.mobileappbase.dev,com.mobileappbase.staging,com.mobileappbase"
```

Everyone else, and CI:

```bash
bundle exec fastlane match development --readonly
```

**Why it's worth the setup:** Apple caps you at 3 distribution certificates per
team. Without match, each developer and CI runner generates their own, you hit the
cap, someone revokes one to make room, and every other machine's builds break.

### Manual alternative

Only reasonable for a solo developer:

1. Xcode → Settings → Accounts → add your Apple ID → Manage Certificates → `+`.
2. developer.apple.com → Identifiers → register all three bundle ids.
3. Profiles → create a Development and an App Store profile per bundle id.
4. Signing & Capabilities → "Automatically manage signing" and pick your team.

Trade-off: fine alone, painful the moment a second person or a CI runner joins.

### Certificate types

| Type | Use | Notes |
|---|---|---|
| Apple Development | Run on your devices | Per developer |
| Apple Distribution | TestFlight + App Store | **Max 3 per team** |
| APNs Auth Key (`.p8`) | Push | One per team, never expires, downloadable once |

---

## Capabilities

Enable in Xcode (target → Signing & Capabilities) **and** on the App ID in the
Developer Portal — both, or you get a signing mismatch at archive time.

Required by this template:

- **Push Notifications**
- **Background Modes** → Remote notifications
- **Keychain Sharing** — only if you share credentials with an extension or
  another app; `react-native-keychain` does not need it for single-app use.

Associated Domains is needed only if you enable universal links; add
`applinks:example.com` and host `apple-app-site-association` at
`https://example.com/.well-known/apple-app-site-association`.

---

## App Store submission checklist

### Before the first upload

- [ ] Replace the app icon (`ios/MobileAppBase/Images.xcassets/AppIcon.appiconset`) — a 1024×1024 with **no alpha channel and no transparency**, or upload is rejected.
- [ ] Replace the splash logo: edit `assets/bootsplash_logo.svg`, then
      `npx react-native-bootsplash generate assets/bootsplash_logo.svg --platforms=android,ios --background=#FFFFFF --logo-width=120 --assets-output=assets/bootsplash --flavor=main`
- [ ] Set a real `MARKETING_VERSION` (user-visible) and `CURRENT_PROJECT_VERSION` (build number).
- [ ] Delete unused permission strings from `Info.plist`. The template ships
      Camera / Photo Library / Face ID descriptions as examples — **an unused
      permission string with no corresponding functionality gets rejected**, and so
      does a used permission with a vague description.
- [ ] Confirm `NSAppTransportSecurity` still has `NSAllowsArbitraryLoads: false`.

### Privacy

- [ ] Update `ios/MobileAppBase/PrivacyInfo.xcprivacy`. Apple requires declared
      reasons for "required reason APIs" (file timestamps, `UserDefaults`, disk
      space, system boot time). MMKV and several RN internals touch these.
- [ ] Fill in App Privacy in App Store Connect. With this template's defaults:
      Sentry collects crash data and a user id; Firebase Messaging collects a device id.
- [ ] Confirm no IDFA usage unless you added an ads SDK — `add_id_info_uses_idfa`
      is set to `false` in the Fastfile.
- [ ] Add a privacy policy URL (required for any app that collects anything).

### Content and review

- [ ] Screenshots for 6.9" and 6.5" iPhone; iPad only if you support it.
- [ ] Demo account credentials in review notes if the app requires login —
      **the most common rejection is a reviewer unable to get past your login screen.**
- [ ] Sign in with Apple is **required** if you offer any third-party social login.
- [ ] Account deletion must be available in-app if you support account creation.
- [ ] Export compliance: standard HTTPS only → answer "No" to the encryption
      question, or set `ITSAppUsesNonExemptEncryption: false` in `Info.plist`.

### Ship

```bash
bundle exec fastlane ios beta env:prod
```

```bash
bundle exec fastlane ios release env:prod
```

---

## Common build failures

| Error | Fix |
|---|---|
| `Unicode Normalization not appropriate for ASCII-8BIT` | No UTF-8 locale. `export LANG=en_US.UTF-8` before `pod install`. Hits any path with spaces. |
| `The Swift pod FirebaseCoreInternal depends upon GoogleUtilities, which does not define modules` | The `:modular_headers => true` lines in the Podfile were removed. Restore them. |
| `[react-native-firebase] SPM + static linkage is not supported` | `$RNFirebaseDisableSPM = true` was removed from the Podfile. |
| `No such module 'RNBootSplash'` / `FirebaseCore` | Run `npm run pods`. You opened the `.xcodeproj` instead of the `.xcworkspace`. |
| `Multiple commands produce Info.plist` | Info.plist was added to Copy Bundle Resources. Remove it — it's referenced via `INFOPLIST_FILE`. |
| Bundle id is empty / wrong | `ios/Config/*.xcconfig` missing. Run `npm run identity`. |
| Signing mismatch on archive | Capability enabled in Xcode but not on the App ID in the portal. |
| `Command PhaseScriptExecution failed` in the RN bundle phase | Node not found by Xcode. Set the path in `ios/.xcode.env.local`. |
| Archive succeeds, upload rejected for "Invalid bundle structure" | A static framework got embedded. Only relevant if you enabled `use_frameworks!`. |
