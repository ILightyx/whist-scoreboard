import { describe, expect, it } from 'vitest';
import { en, type MessageKey, type Plural } from './en';
import { describeIssue } from './issues';
import { ro } from './ro';
import { systemLanguage, translate, translator } from './translate';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
const forms = (message: string | Plural) => (typeof message === 'string' ? [message] : Object.values(message).filter(Boolean));

describe('Romanian text', () => {
  const keys = Object.keys(en) as MessageKey[];

  it.each(keys)('%s uses the same placeholders as English', (key) => {
    const expected = placeholders(forms(en[key]).at(-1)!);
    for (const form of forms(ro[key])) expect(placeholders(form), form).toEqual(expected);
  });

  it('has every plural form Romanian needs (one, few, other)', () => {
    for (const key of keys) {
      if (typeof en[key] !== 'string') expect(Object.keys(ro[key]).sort(), key).toEqual(['few', 'one', 'other']);
    }
  });

  it('writes ș and ț with a comma below, never the cedilla forms', () => {
    for (const key of keys) for (const form of forms(ro[key])) expect(form, key).not.toMatch(/[şţŞŢ]/);
  });
});

describe('translate', () => {
  it('picks Romanian plural forms (1 rundă, 3 runde, 32 de runde)', () => {
    expect(translate('ro', 'setup.rentzRounds', { count: 1 })).toMatch(/: 1 rundă\.$/);
    expect(translate('ro', 'setup.rentzRounds', { count: 3 })).toMatch(/: 3 runde\.$/);
    expect(translate('ro', 'setup.rentzRounds', { count: 32 })).toMatch(/: 32 de runde\.$/);
    expect(translate('en', 'setup.rentzRounds', { count: 32 })).toMatch(/: 32 rounds\.$/);
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(translate('en', 'home.roundOf', { round: 3, total: 12 })).toBe('Round 3 of 12');
    expect(translate('ro', 'home.roundOf', { round: 3 })).toBe('Runda 3 din {total}');
  });

  it('follows the device language when the app has it', () => {
    expect(systemLanguage(['ro-RO'])).toBe('ro');
    expect(systemLanguage(['de-DE', 'ro'])).toBe('ro');
    expect(systemLanguage(['en-GB', 'ro-RO'])).toBe('en');
    expect(systemLanguage(['fr-FR'])).toBe('en');
  });

  it('explains round issues in either language', () => {
    const issue = { kind: 'banned-bet', seat: 1, bet: 2 } as const;
    expect(describeIssue(translator('en'), issue, ['Ana', 'Dan'])).toBe("Dan bets last and can't bet 2.");
    expect(describeIssue(translator('ro'), issue, ['Ana', 'Dan'])).toBe('Dan pariază ultimul și nu poate paria 2.');
  });
});
