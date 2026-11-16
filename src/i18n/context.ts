import { createContext, useContext } from 'react';
import type { Language, Translate } from './translate';

export type LanguageSetting = Language | 'auto';

export interface I18n {
  /** The language in use. */
  language: Language;
  /** What the user picked: a language, or follow the device. */
  setting: LanguageSetting;
  setSetting: (setting: LanguageSetting) => void;
  t: Translate;
}

export const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error('useI18n needs an <I18nProvider>');
  return i18n;
}

export function useT(): Translate {
  return useI18n().t;
}
