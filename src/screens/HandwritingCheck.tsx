import { useState } from 'react';
import type { Stroke } from '../ink/raster';
import { InkSurface } from '../ink/InkSurface';
import { loadModel, recognize } from '../ink/recognizer';
import { useT } from '../i18n/context';

interface Sample {
  digit: number;
  recognized: number | null;
  strokes: Stroke[];
}

/**
 * Write the digit shown; the app records what it recognised. Shows accuracy on
 * your own handwriting and exports the samples (to check or fine-tune the model).
 */
export function HandwritingCheck({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [target, setTarget] = useState(() => Math.floor(Math.random() * 10));
  const [round, setRound] = useState(0);
  const correct = samples.filter((sample) => sample.recognized === sample.digit).length;

  // Scores the model's own first guess (not a suggestion you pick), so the
  // accuracy shown is what the score sheet would accept without help.
  const record = async (strokes: Stroke[]) => {
    let recognized: number | null = null;
    try {
      recognized = recognize(await loadModel(), strokes, 9)[0]?.value ?? null;
    } catch {
      recognized = null;
    }
    setSamples((current) => [...current, { digit: target, recognized, strokes }]);
    setTarget(Math.floor(Math.random() * 10));
    setRound((value) => value + 1);
  };

  return (
    <div className="modal-backdrop">
      <div className="dialog handwriting-check" role="dialog" aria-label={t('check.title')}>
        <h2>{t('check.title')}</h2>
        <p className="muted">{t('check.intro')}</p>
        <div className="check-target">{target}</div>
        <div className="check-pad input-cell" key={round}>
          <InkSurface
            max={9}
            banned={null}
            label={t('check.title')}
            cellId="handwriting check"
            onStrokes={(strokes) => void record(strokes)}
            onRecognized={() => undefined}
            onClear={() => undefined}
            onTap={() => undefined}
          />
        </div>
        <p>
          {samples.length
            ? t('check.result', { correct, total: samples.length, percent: Math.round((correct / samples.length) * 100) })
            : t('check.noSamples')}
        </p>
        <div className="dialog-actions">
          <button
            className="secondary"
            disabled={!samples.length}
            onClick={() => {
              const blob = new Blob([JSON.stringify({ format: 'scorekeeper-ink-samples', version: 1, samples })], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `handwriting-samples-${new Date().toISOString().slice(0, 10)}.json`;
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            {t('check.export')}
          </button>
          <button className="primary" onClick={onClose}>
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
