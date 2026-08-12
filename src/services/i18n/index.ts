/**
 * i18next configuration.
 *
 * Language resolution order:
 *   1. The user's explicit choice, persisted in the settings store.
 *   2. The device locale, if we ship that language.
 *   3. English.
 *
 * Note `compatibilityJSON` is not needed on Hermes — Hermes ships full Intl
 * support, so plural rules (count_one / count_other) work natively.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';

import { useSettingsStore, type SupportedLanguage } from '../../store/settingsStore';
import en from './locales/en.json';
import es from './locales/es.json';

export const resources = {
  en: { translation: en },
  es: { translation: es },
} as const;

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'es'];
export const FALLBACK_LANGUAGE: SupportedLanguage = 'en';

/** Best available language for this device, given what we actually ship. */
export function detectDeviceLanguage(): SupportedLanguage {
  const best = RNLocalize.findBestLanguageTag(SUPPORTED_LANGUAGES);
  if (best && SUPPORTED_LANGUAGES.includes(best.languageTag as SupportedLanguage)) {
    return best.languageTag as SupportedLanguage;
  }
  // findBestLanguageTag can return a regional tag like 'es-MX'; take the base.
  const base = best?.languageTag?.split('-')[0] as SupportedLanguage | undefined;
  return base && SUPPORTED_LANGUAGES.includes(base) ? base : FALLBACK_LANGUAGE;
}

export function initI18n(): typeof i18n {
  // The persisted store is already hydrated at this point because MMKV is
  // synchronous — no async bootstrap needed.
  const stored = useSettingsStore.getState().language;
  const initialLanguage = SUPPORTED_LANGUAGES.includes(stored) ? stored : detectDeviceLanguage();

  void i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: FALLBACK_LANGUAGE,
    // React already escapes everything it renders; double-escaping mangles
    // apostrophes and quotes in translations.
    interpolation: { escapeValue: false },
    returnNull: false,
    // Surface missing keys loudly in development instead of silently rendering
    // the key name in production.
    saveMissing: __DEV__,
    missingKeyHandler: __DEV__
      ? (_lng, _ns, key) => console.warn(`[i18n] Missing translation: ${key}`)
      : undefined,
  });

  return i18n;
}

/** Change language and persist the choice. */
export async function changeLanguage(language: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  useSettingsStore.getState().setLanguage(language);
}

export default i18n;
