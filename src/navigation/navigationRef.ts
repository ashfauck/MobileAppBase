/**
 * Imperative navigation for code that runs outside the React tree.
 *
 * Needed by: notification tap handlers, the axios auth-failure hook, and deep
 * links that arrive before the navigator has mounted.
 *
 * The `pendingNavigation` buffer solves a real race: when the app is launched
 * from a cold start by tapping a notification, the handler fires before
 * NavigationContainer is ready. Navigating then is a silent no-op. We stash the
 * intent and flush it from the container's onReady.
 */
import {
  createNavigationContainerRef,
  type NavigationAction,
} from '@react-navigation/native';

import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

type PendingNavigation = {
  name: keyof RootStackParamList;
  params?: RootStackParamList[keyof RootStackParamList];
};

let pendingNavigation: PendingNavigation | null = null;

/**
 * React Navigation types `navigate` as a heavily-overloaded generic that can't
 * be called with a runtime-chosen (name, params) pair. Narrowing to this
 * signature once, here, keeps the cast contained — every exported function
 * below stays fully type-safe at its call sites.
 */
type LooseNavigate = (name: string, params?: object) => void;

function rawNavigate(name: string, params?: object): void {
  (navigationRef.navigate as unknown as LooseNavigate)(name, params);
}

export function navigate<T extends keyof RootStackParamList>(
  name: T,
  params?: RootStackParamList[T],
): void {
  if (navigationRef.isReady()) {
    rawNavigate(name, params as object | undefined);
  } else {
    pendingNavigation = { name, params };
  }
}

/** Call from NavigationContainer's onReady. */
export function flushPendingNavigation(): void {
  if (!pendingNavigation || !navigationRef.isReady()) return;

  const { name, params } = pendingNavigation;
  pendingNavigation = null;
  rawNavigate(name, params as object | undefined);
}

export function dispatch(action: NavigationAction): void {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(action);
  }
}

/** Current route name — useful for analytics and Sentry breadcrumbs. */
export function getCurrentRouteName(): string | undefined {
  return navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
}

/** Test helper. */
export function __clearPendingNavigation(): void {
  pendingNavigation = null;
}
