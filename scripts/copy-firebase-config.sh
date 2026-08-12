#!/bin/bash
#
# Copies the per-environment GoogleService-Info.plist into the built .app.
#
# Run as an Xcode build phase (added by scripts/ios-setup-flavors.rb). The
# environment name comes from APP_ENVIRONMENT, which each ios/Config/*.xcconfig
# defines — so the Dev scheme picks up the dev Firebase project automatically.
#
# Expected layout (these files are git-ignored — they are per-project secrets-ish
# config, and the dev/staging ones usually shouldn't ship in a public repo):
#
#   ios/Firebase/dev/GoogleService-Info.plist
#   ios/Firebase/staging/GoogleService-Info.plist
#   ios/Firebase/prod/GoogleService-Info.plist
#
set -euo pipefail

ENV_NAME="${APP_ENVIRONMENT:-prod}"
SOURCE="${PROJECT_DIR}/Firebase/${ENV_NAME}/GoogleService-Info.plist"
DESTINATION="${BUILT_PRODUCTS_DIR}/${CONTENTS_FOLDER_PATH}/GoogleService-Info.plist"

if [ ! -f "${SOURCE}" ]; then
  # A warning rather than an error: the template must build before Firebase
  # has been set up. Push simply stays disabled until the plist exists.
  echo "warning: No GoogleService-Info.plist for environment '${ENV_NAME}' at ${SOURCE} — push notifications disabled for this build."
  exit 0
fi

# Sanity check: a mismatched plist silently produces tokens for the wrong
# Firebase project, which is painful to debug from the JS side.
PLIST_BUNDLE_ID=$(/usr/libexec/PlistBuddy -c "Print :BUNDLE_ID" "${SOURCE}" 2>/dev/null || echo "")
if [ -n "${PLIST_BUNDLE_ID}" ] && [ -n "${APP_BUNDLE_ID:-}" ] && [ "${PLIST_BUNDLE_ID}" != "${APP_BUNDLE_ID}" ]; then
  echo "error: GoogleService-Info.plist BUNDLE_ID (${PLIST_BUNDLE_ID}) does not match APP_BUNDLE_ID (${APP_BUNDLE_ID})."
  echo "error: Add an iOS app with bundle id ${APP_BUNDLE_ID} to your '${ENV_NAME}' Firebase project and re-download the plist."
  exit 1
fi

cp "${SOURCE}" "${DESTINATION}"
echo "Copied Firebase config for '${ENV_NAME}' (${PLIST_BUNDLE_ID:-unknown bundle id})"
