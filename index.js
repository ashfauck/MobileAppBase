/**
 * @format
 *
 * Entry point.
 *
 * Everything registered here runs BEFORE React mounts — and, critically, also
 * runs in the headless JS context that Android/iOS spin up to deliver a
 * notification while the app is killed. That is why the background handlers
 * live here and not inside a component.
 */
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';

import App from './src/app/App';
import { initSentry, Sentry } from './src/services/monitoring/sentry';
import { backgroundHandlers } from './src/services/notifications/pushService';
import { name as appName } from './app.json';

// Initialize crash reporting first so errors during startup are captured.
initSentry();

/**
 * Data-only messages delivered while the app is backgrounded or killed.
 *
 * Must be registered at module scope, outside any component. If you register
 * it inside a component it never runs for a killed app and your notifications
 * silently disappear.
 */
messaging().setBackgroundMessageHandler(backgroundHandlers.onBackgroundMessage);

/**
 * Action-button presses on a notification while backgrounded or killed.
 * Handles the "user tapped Accept from the lock screen" case.
 */
notifee.onBackgroundEvent(backgroundHandlers.onBackgroundEvent);

/**
 * Sentry.wrap enables the performance/profiling integrations and the automatic
 * component-tree tagging on crashes.
 */
AppRegistry.registerComponent(appName, () => Sentry.wrap(App));
