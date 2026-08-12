/**
 * Navigation type definitions.
 *
 * Every param list lives here so screens can import a single `Props` type and
 * get fully typed `route.params` and `navigation.navigate(...)`.
 */
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** Screens shown when the user is signed out. */
export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: { email?: string } | undefined;
};

/** Tabs shown when the user is signed in. */
export type MainTabParamList = {
  Home: undefined;
  Tasks: undefined;
  Notifications: undefined;
  Settings: undefined;
};

/** The root: either the auth stack or the app, plus modal-style screens. */
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  /** Pushed from a notification tap; id comes from the push payload. */
  NotificationDetail: { notificationId: string };
};

/* --------------------------------------------------------------- helpers ---
 * Screen prop helpers. Usage:
 *   export default function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {}
 */
export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<
  MainTabParamList,
  T
>;

/**
 * Makes `navigation.navigate('Home')` typecheck globally, including inside
 * `useNavigation()` calls that don't specify a generic.
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
