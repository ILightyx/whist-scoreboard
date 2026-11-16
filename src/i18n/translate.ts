// Turns a message key into text in the chosen language. Plain functions, so
// they also work outside React (and in tests).

import { en, type MessageKey, type Messages, type Plural } from './en';
import { ro } from './ro';

/** Languages the app ships, by their own name (never translated). */
export const LANGUAGES = { en: 'English', ro: 'Română' } as const;
export type Language = keyof typeof LANGUAGES;

const DICTIONARIES: Record<Language, Messages> = { en, ro };

export type Params = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: Params) => string;

export function isLanguage(value: string): value is Language {
  return Object.prototype.hasOwnProperty.call(LANGUAGES, value);
}

/** The first of the device's preferred languages that the app has, else English. */
export function systemLanguage(preferred: readonly string[] = navigator.languages?.length ? navigator.languages : [navigator.language]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return 'en';
}

export function translate(language: Language, key: MessageKey, params: Params = {}): string {
  const message: string | Plural = DICTIONARIES[language][key] ?? en[key];
  let text: string;
  if (typeof message === 'string') {
    text = message;
  } else {
    const form = new Intl.PluralRules(language).select(Number(params.count ?? 0));
    text = (form === 'one' || form === 'few' ? message[form] : undefined) ?? message.other;
  }
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match));
}

export function translator(language: Language): Translate {
  return (key, params) => translate(language, key, params);
}
