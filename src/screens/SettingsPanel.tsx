import { useState } from 'react';
import { loadInkStats, loadSettings, storeSettings } from '../storage/db';
import { HandwritingCheck } from './HandwritingCheck';
import { useI18n, type LanguageSetting } from '../i18n/context';
import { LANGUAGES, type Language, systemLanguage } from '../i18n/translate';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { t, setting, setSetting } = useI18n();
  const [settings, setSettings] = useState(loadSettings);
  const [checking, setChecking] = useState(false);
  const stats = loadInkStats();
  if (checking) return <HandwritingCheck onClose={() => setChecking(false)} />;
  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div className="dialog" role="dialog" aria-label={t('settings.title')} onPointerDown={(event) => event.stopPropagation()}>
        <h2>{t('settings.title')}</h2>
        <h3 className="settings-label">{t('settings.language')}</h3>
        <div className="segmented" role="radiogroup" aria-label={t('settings.language')}>
          {(['auto', ...(Object.keys(LANGUAGES) as Language[])] as LanguageSetting[]).map((option) => (
            <button key={option} role="radio" aria-checked={setting === option} className={setting === option ? 'on' : ''} onClick={() => setSetting(option)}>
              {option === 'auto' ? t('settings.languageAuto', { language: LANGUAGES[systemLanguage()] }) : LANGUAGES[option]}
            </button>
          ))}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.fingerWriting}
            onChange={(event) => {
              const next = { ...settings, fingerWriting: event.target.checked };
              setSettings(next);
              storeSettings(next);
            }}
          />
          <span>
            {t('settings.fingerWriting')}
            <small className="muted">{t('settings.fingerWritingHelp')}</small>
          </span>
        </label>
        <p className="muted">
          {t('settings.inkStats', { accepted: stats.accepted, corrected: stats.corrected })}
        </p>
        <div className="dialog-actions">
          <button className="secondary" onClick={() => setChecking(true)}>
            {t('settings.handwritingCheck')}
          </button>
          <button className="primary" onClick={onClose}>
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
