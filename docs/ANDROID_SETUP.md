# Android setup, Gradle, and Play Store

- [Gradle configuration](#gradle-configuration)
- [Product flavors](#product-flavors)
- [Signing](#signing)
- [Play Store requirements](#play-store-requirements)
- [Common build failures](#common-build-failures)

---

## Gradle configuration

| Setting | Value | Where |
|---|---|---|
| compileSdk / targetSdk | 36 (Android 16) | `android/build.gradle` |
| minSdk | 24 (Android 7.0) | `android/build.gradle` |
| JDK | 17 | Required by AGP 8.x |
| Kotlin | 2.1.20 | `android/build.gradle` |
| New Architecture | enabled | `gradle.properties` → `newArchEnabled=true` |
| Hermes | enabled | `gradle.properties` → `hermesEnabled=true` |
| Edge-to-edge | enabled | `gradle.properties` → `edgeToEdgeEnabled=true` |
| R8 minify + resource shrink | release only | `app/build.gradle` |

`local.properties` (git-ignored) points Gradle at your SDK. If a fresh clone
fails with "SDK location not found":

```bash
echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties
```

### Build performance

`gradle.properties` enables the Gradle daemon's parallel execution, the build
cache, and Kotlin incremental compilation. On a machine with less than 16 GB RAM,
lower `org.gradle.jvmargs=-Xmx2048m`.

To build only your device's architecture during development:

```bash
cd android && ./gradlew assembleDevDebug -PreactNativeArchitectures=arm64-v8a
```

---

## Product flavors

Generated into `android/app/identity.gradle` from `app.identity.json` — **edit the
JSON, not the gradle file**, then run `npm run identity`.

| Flavor | applicationId | app_name |
|---|---|---|
| `dev` | `com.mobileappbase.dev` | AppBase Dev |
| `staging` | `com.mobileappbase.staging` | AppBase Stg |
| `prod` | `com.mobileappbase` | AppBase |

Note the `namespace` stays `com.mobileappbase` for every flavor. That's the
Java/Kotlin package (where `R` and `BuildConfig` are generated) and flavoring it
would break imports in `MainActivity.kt`. Only `applicationId` — the identifier
Play and the device care about — changes.

`app_name` is produced per flavor via `resValue`, which is why it is **not** in
`res/values/strings.xml`. Declaring it in both fails the build with "Duplicate
resources".

### Variants

React Native 0.86 adds a third build type, `debugOptimized`, so each flavor has
three variants:

```
devDebug        devDebugOptimized        devRelease
stagingDebug    stagingDebugOptimized    stagingRelease
prodDebug       prodDebugOptimized       prodRelease
```

Every one of them needs an entry in `project.ext.envConfigFiles` in
`app/build.gradle`, or react-native-config silently falls back to `.env` — the
kind of bug that ships a staging build pointing at the dev API.

```bash
cd android && ./gradlew assembleStagingDebug
cd android && ./gradlew bundleProdRelease      # AAB for Play
```

---

## Signing

### Create an upload keystore

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore release.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Then copy `android/keystore.properties.example` to `android/keystore.properties`
(git-ignored) and fill it in.

`app/build.gradle` reads credentials from that file, falling back to the
`ANDROID_KEYSTORE_*` environment variables so CI can inject them. If neither
exists it signs with the **debug** key and prints a loud warning — that keeps a
fresh clone buildable, but such an APK cannot be uploaded to Play.

### Play App Signing

Strongly recommended: Google holds the real app signing key and you only manage
an *upload* key. If you lose the upload key, Google can reset it. Without Play App
Signing, losing your keystore means **you can never update the app again** under
that listing.

Enrol when creating the app in Play Console (it's the default for new apps).

---

## Play Store requirements

### Before the first upload

- [ ] `applicationId` is final. **It can never be changed after publishing.**
      Also note Play rejects anything starting with `com.example.`.
- [ ] Replace launcher icons in `android/app/src/main/res/mipmap-*`. Use Android
      Studio → New → Image Asset to generate adaptive icons (foreground + background layers).
- [ ] `versionCode` must strictly increase on every upload. CI passes
      `-PversionCode=${{ github.run_number }}`.
- [ ] Upload an **AAB** (`bundleProdRelease`), not an APK. APKs haven't been
      accepted for new apps since 2021.

### Policy

- [ ] **Target API level:** new apps and updates must target within one year of
      the latest Android release. This template targets 36; check the
      [current deadline](https://developer.android.com/google/play/requirements/target-sdk).
- [ ] **Data safety form** — must match what the app actually does. With the
      template's defaults: Firebase Messaging collects a device identifier;
      Sentry collects crash logs and a user id. Under-declaring is a suspension risk.
- [ ] **Privacy policy URL** — required for essentially every app now.
- [ ] `POST_NOTIFICATIONS` is declared; make sure your Data Safety answers and
      store listing reflect that you send notifications.
- [ ] Remove any permission you don't actually use. Each one needs justification,
      and the sensitive ones (location, contacts, `QUERY_ALL_PACKAGES`) need a
      declaration form.
- [ ] Account deletion must be offered in-app **and** via a web URL if you support
      account creation.

### Test before release

- [ ] Test a **release** build, not just debug — R8 is only enabled for release and
      is a classic source of "works in debug, crashes in production".

```bash
cd android && ./gradlew installProdRelease
```

- [ ] Test on Android 13+ for the notification permission prompt.
- [ ] Test with "Don't keep activities" enabled (Developer Options) to catch
      process-death bugs. `MainActivity.onCreate` passes `null` for
      `savedInstanceState`, which is required by react-native-screens.

### Ship

```bash
bundle exec fastlane android deploy env:prod track:internal
```

Promote `internal` → `alpha` → `beta` → `production` in Play Console. The Fastfile
applies a 10% staged rollout for the `production` track.

---

## Common build failures

| Error | Fix |
|---|---|
| `SDK location not found` | Create `android/local.properties` with `sdk.dir=...`, or export `ANDROID_HOME`. |
| `Manifest merger failed ... default_notification_channel_id` | `tools:replace="android:value"` was removed from the manifest meta-data. |
| `Duplicate resources` for `app_name` | `app_name` was added back to `res/values/strings.xml`. It must only come from `resValue` in `identity.gradle`. |
| `File google-services.json is missing` | Add it under `android/app/src/<flavor>/`, or remove the flavor's Firebase usage. The plugin is skipped when none exists. |
| `Could not find method flavorDimensions()` | `identity.gradle` missing. Run `npm run identity`. |
| `Unsupported class file major version` | Wrong JDK. Use 17: `export JAVA_HOME=$(/usr/libexec/java_home -v 17)`. |
| Release build crashes on launch, debug is fine | R8 stripped something. Add keep rules to `android/app/proguard-rules.pro`. |
| `Execution failed for task ':app:checkDevDebugDuplicateClasses'` | Two libraries pulling different versions of the same transitive dep. Run `./gradlew :app:dependencies` to find it. |
| Metro connects but app shows a blank screen | Wrong flavor installed. Check the applicationId with `adb shell pm list packages \| grep mobileappbase`. |
