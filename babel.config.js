module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    /**
     * Reanimated 4 moved its worklet transform into react-native-worklets.
     * (Using 'react-native-reanimated/plugin' still works but is a deprecated
     * shim that just re-exports this one.)
     *
     * MUST be the last plugin in the list — it needs to run after every other
     * transform, or worklets silently fall back to running on the JS thread.
     */
    'react-native-worklets/plugin',
  ],
};
