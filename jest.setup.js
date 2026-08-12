/**
 * Native module mocks.
 *
 * Every library backed by native code must be mocked, because Jest runs in Node
 * with no bridge/JSI. Runs BEFORE the test framework is installed, so it can
 * only use jest.mock and plain values (no expect/afterEach here — those belong
 * in jest.setup-after-env.js).
 */

/* ------------------------------------------------------ react-native-config */
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    APP_ENV: 'dev',
    API_URL: 'https://api.test.local',
    API_TIMEOUT_MS: '5000',
    SENTRY_DSN: '',
    SENTRY_TRACES_SAMPLE_RATE: '0',
    ENABLE_DEV_MENU: 'true',
    LOG_LEVEL: 'error',
  },
}));

/* --------------------------------------------------------- MMKV (via Nitro) */
/**
 * react-native-mmkv v4 already returns an in-memory instance under Jest — its
 * createMMKV() checks JEST_WORKER_ID and calls createMockMMKV(). So MMKV itself
 * must NOT be mocked, or the real `createMMKV` export disappears.
 *
 * What does need mocking is Nitro: react-native-mmkv imports getMMKVFactory at
 * module scope, which reaches TurboModuleRegistry.getEnforcing('NitroModules')
 * during import — before the isTest() branch ever runs — and throws an
 * Invariant Violation. Stubbing the Nitro module keeps the import graph intact
 * and lets MMKV's own test path take over.
 */
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => ({})),
    box: jest.fn((value) => value),
    get hasNativeModule() {
      return false;
    },
  },
}));

/* ------------------------------------------------------------- Keychain */
jest.mock('react-native-keychain', () => {
  let stored = null;

  return {
    ACCESSIBLE: {
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AfterFirstUnlockThisDeviceOnly',
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
    },
    setGenericPassword: jest.fn(async (username, password) => {
      stored = { username, password };
      return true;
    }),
    getGenericPassword: jest.fn(async () => stored),
    resetGenericPassword: jest.fn(async () => {
      stored = null;
      return true;
    }),
    __setStored: (value) => {
      stored = value;
    },
  };
});

/* ------------------------------------------------------ Firebase messaging */
// v26 is modular-only: standalone functions taking a Messaging instance.
// There is no default export to mock any more.
jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  getMessaging: jest.fn(() => ({ __brand: 'messaging' })),
  getToken: jest.fn(async () => 'test-fcm-token'),
  onTokenRefresh: jest.fn(() => jest.fn()),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn(async () => null),
  registerDeviceForRemoteMessages: jest.fn(async () => undefined),
  setBackgroundMessageHandler: jest.fn(),
  requestPermission: jest.fn(async () => 1),
  AuthorizationStatus: { DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2, NOT_DETERMINED: -1 },
}));

/* ------------------------------------------------------------------ Notifee */
jest.mock('@notifee/react-native', () => {
  const notifeeMock = {
    createChannel: jest.fn(async () => 'channel-id'),
    setNotificationCategories: jest.fn(async () => undefined),
    displayNotification: jest.fn(async () => 'notification-id'),
    createTriggerNotification: jest.fn(async () => 'trigger-id'),
    cancelNotification: jest.fn(async () => undefined),
    requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })),
    getNotificationSettings: jest.fn(async () => ({ authorizationStatus: 1 })),
    onForegroundEvent: jest.fn(() => jest.fn()),
    onBackgroundEvent: jest.fn(),
    setBadgeCount: jest.fn(async () => undefined),
  };

  return {
    __esModule: true,
    default: notifeeMock,
    AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2 },
    AndroidVisibility: { PRIVATE: 0, PUBLIC: 1, SECRET: -1 },
    AuthorizationStatus: { DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2, NOT_DETERMINED: -1 },
    EventType: { DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3 },
    TriggerType: { TIMESTAMP: 0, INTERVAL: 1 },
  };
});

/* ------------------------------------------------------------------- Sentry */
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (component) => component,
  captureException: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  reactNavigationIntegration: jest.fn(() => ({
    registerNavigationContainer: jest.fn(),
  })),
}));

/* -------------------------------------------------------------- Bootsplash */
jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: {
    hide: jest.fn(async () => undefined),
    isVisible: jest.fn(async () => false),
    useHideAnimation: jest.fn(),
  },
}));

/* ------------------------------------------------------------- device info */
jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {
    getVersion: () => '1.0.0',
    getBuildNumber: () => '1',
    getBundleId: () => 'com.mobileappbase.dev',
    getUniqueId: async () => 'test-device-id',
  },
}));

/* ---------------------------------------------------------------- localize */
jest.mock('react-native-localize', () => ({
  findBestLanguageTag: () => ({ languageTag: 'en', isRTL: false }),
  getLocales: () => [{ languageCode: 'en', countryCode: 'US', languageTag: 'en-US', isRTL: false }],
  getTimeZone: () => 'UTC',
}));

/* --------------------------------------------------------------- clipboard */
jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: jest.fn(), getString: jest.fn(async () => '') },
}));

/* ------------------------------------------------------------- reanimated */
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

/* --------------------------------------------------------- gesture handler */
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    GestureHandlerRootView: View,
    PanGestureHandler: View,
    TapGestureHandler: View,
    State: {},
    Directions: {},
    gestureHandlerRootHOC: (component) => component,
  };
});

/* ------------------------------------------------------------- FlashList */
// FlashList's recycling requires a real layout pass, which jsdom-less Jest
// doesn't do. Rendering as a plain FlatList keeps list assertions meaningful.
jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { FlatList } = require('react-native');
  return {
    FlashList: React.forwardRef((props, ref) => React.createElement(FlatList, { ...props, ref })),
  };
});

/* ------------------------------------------------------------ safe area */
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    initialWindowMetrics: { insets: inset, frame: { x: 0, y: 0, width: 390, height: 844 } },
    SafeAreaInsetsContext: React.createContext(inset),
  };
});
