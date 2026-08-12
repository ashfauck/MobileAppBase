module.exports = {
  preset: '@react-native/jest-preset',

  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup-after-env.js'],

  /**
   * Most React Native libraries ship untranspiled ESM/Flow. Jest ignores
   * node_modules by default, so each one has to be allow-listed here or you get
   * "SyntaxError: Cannot use import statement outside a module".
   */
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      [
        'react-native',
        '@react-native',
        '@react-native-community',
        '@react-navigation',
        '@react-native-firebase',
        '@notifee',
        '@shopify/flash-list',
        '@sentry/react-native',
        'react-native-mmkv',
        'react-native-nitro-modules',
        'react-native-keychain',
        'react-native-reanimated',
        'react-native-worklets',
        'react-native-gesture-handler',
        'react-native-safe-area-context',
        'react-native-screens',
        'react-native-config',
        'react-native-localize',
        'react-native-bootsplash',
        'react-native-device-info',
        'react-native-permissions',
        'react-native-edge-to-edge',
        'react-native-svg',
        '@react-native-clipboard',
        // Not React Native libs, but both resolve to ESM-only builds under Jest.
        'immer',
        'zustand',
      ].join('|') +
      ')/)',
  ],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/config/identity.generated.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 40,
      branches: 30,
      functions: 35,
      lines: 40,
    },
  },

  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  clearMocks: true,
  resetMocks: false,
};
