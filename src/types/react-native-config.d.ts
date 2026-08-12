/**
 * react-native-config ships a loose `{[key: string]: string}` type.
 * Narrowing it here gives autocomplete and catches typos in env keys,
 * while still allowing `string | undefined` (a key can be absent from
 * the .env that was compiled into this binary).
 */
declare module 'react-native-config' {
  export interface NativeConfig {
    APP_ENV?: string;
    API_URL?: string;
    API_TIMEOUT_MS?: string;
    SENTRY_DSN?: string;
    SENTRY_TRACES_SAMPLE_RATE?: string;
    ENABLE_DEV_MENU?: string;
    LOG_LEVEL?: string;
    [key: string]: string | undefined;
  }

  export const Config: NativeConfig;
  export default Config;
}
