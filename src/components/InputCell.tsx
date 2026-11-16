import { InkSurface } from '../ink/InkSurface';

export interface InputCellProps {
  value: number | null;
  /** Largest allowed value; handwriting and the pad only accept 0..max. */
  max: number;
  /** A value this cell may not take (the last bettor's banned bet). */
  banned?: number | null;
  label: string;
  disabled?: boolean;
  /** Small hint shown in the corner, e.g. "≠1" or "1st". */
  hint?: string;
  invalid?: boolean;
  onChange: (value: number | null) => void;
  /** Open the number pad for this cell (tap, or double tap while writing). */
  onRequestPad: () => void;
}

/**
 * One handwritten number on the sheet. With a pen you write straight into it;
 * a tap (or a finger, unless finger writing is on) opens the number pad.
 */
export function InputCell(props: InputCellProps) {
  const { value, max, banned, label, disabled, hint, invalid, onChange, onRequestPad } = props;
  const classes = ['input-cell'];
  if (value === null) classes.push('empty');
  if (invalid) classes.push('invalid');
  if (disabled) classes.push('disabled');
  return (
    <div className={classes.join(' ')} aria-label={label} data-cell={label}>
      <span className="cell-value">{value ?? ''}</span>
      {hint ? <span className="cell-hint">{hint}</span> : null}
      {disabled ? null : (
        <InkSurface
          max={max}
          banned={banned ?? null}
          label={label}
          onRecognized={onChange}
          onClear={() => onChange(null)}
          onTap={onRequestPad}
        />
      )}
    </div>
  );
}

/** A yes/no cell (who took the King of Hearts): tap to mark. */
export function ToggleCell({ value, label, disabled, onChange }: { value: number | null; label: string; disabled?: boolean; onChange: (value: number | null) => void }) {
  return (
    <button
      className={value === 1 ? 'toggle-cell on' : 'toggle-cell'}
      aria-label={label}
      aria-pressed={value === 1}
      data-cell={label}
      disabled={disabled}
      onClick={() => onChange(value === 1 ? 0 : 1)}
    >
      <span className={value === 1 ? '' : 'toggle-hint'}>K♥</span>
    </button>
  );
}
