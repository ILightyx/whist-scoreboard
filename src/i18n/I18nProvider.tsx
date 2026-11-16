import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { loadLanguageSetting, storeLanguageSetting } from '../storage/db';
import { I18nContext, type I18n, type LanguageSetting } from './context';
import { isLanguage, systemLanguage, translator } from './translate';

function initialSetting(): LanguageSetting {
  const stored = loadLanguageSetting();
  return stored && isLanguage(stored) ? stored : 'auto';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [setting, setSetting] = useState<LanguageSetting>(initialSetting);
  const language = setting === 'auto' ? systemLanguage() : setting;

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18n>(
    () => ({
      language,
      setting,
      setSetting: (next) => {
        storeLanguageSetting(next);
        setSetting(next);
      },
      t: translator(language),
    }),
    [language, setting],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
