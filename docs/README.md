# Documentation

| Guide | Read it when |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Before making structural changes — why the template is shaped this way, and what each decision prevents. |
| [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md) | Setting up Firebase/APNs, adding notification categories, or debugging why a push didn't arrive. |
| [IOS_SETUP.md](IOS_SETUP.md) | Certificates, provisioning, schemes, App Store submission, iOS build errors. |
| [ANDROID_SETUP.md](ANDROID_SETUP.md) | Gradle flavors, keystores, Play Store requirements, Android build errors. |

Start with the [root README](../README.md) — it covers setup, the environment
system, state management, and CI/CD.

## Quick answers

**How do I change the app name / bundle id?**
Edit `app.identity.json`, run `npm run identity`. Nothing else hardcodes them.

**How do I add an environment (e.g. `qa`)?**
Add it to `app.identity.json`, create `.env.qa`, run `npm run identity`, then
`bundle exec ruby scripts/ios-setup-flavors.rb` and `npm run pods`. Add the new
variants to `envConfigFiles` and `debuggableVariants` in `android/app/build.gradle`,
and to the `project` mapping in `ios/Podfile`.

**Why isn't my new env var showing up?**
react-native-config compiles values in at **build** time. Rebuild the native app —
a Metro reload is not enough.

**Why did my Android release build crash when debug was fine?**
R8 only runs on release. Add keep rules to `android/app/proguard-rules.pro`.

**Tests hang with "Jest did not exit one second after…"**
A QueryClient in a test needs `gcTime: 0`; the 5-minute default leaves a GC timer
per settled mutation.
