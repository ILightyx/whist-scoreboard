import { useState } from 'react';
import { loadInkStats, loadSettings, storeSettings } from '../storage/db';
import { HandwritingCheck } from './HandwritingCheck';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState(loadSettings);
  const [checking, setChecking] = useState(false);
  const stats = loadInkStats();
  if (checking) return <HandwritingCheck onClose={() => setChecking(false)} />;
  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div className="dialog" role="dialog" aria-label="Settings" onPointerDown={(event) => event.stopPropagation()}>
        <h2>Settings</h2>
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
            Write with a finger too
            <small className="muted">
              Off: only a pen writes, and a resting hand is ignored. A finger tap opens the number pad.
            </small>
          </span>
        </label>
        <p className="muted">
          Handwriting so far: {stats.accepted} read directly, {stats.corrected} picked from suggestions.
        </p>
        <div className="dialog-actions">
          <button className="secondary" onClick={() => setChecking(true)}>
            Handwriting check
          </button>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
