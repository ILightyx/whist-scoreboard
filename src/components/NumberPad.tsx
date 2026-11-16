import { useLayoutEffect } from 'react';

export interface NumberPadRequest {
  title: string;
  max: number;
  value: number | null;
  /** A value that is not allowed here (the last bettor's banned bet). */
  banned?: number | null;
  onPick: (value: number | null) => void;
}

/** Large-button number pad: the fallback to handwriting, usable with a pen or a finger. */
export function NumberPad({ request, onClose }: { request: NumberPadRequest; onClose: () => void }) {
  // Layout effect: the keys work from the moment the pad is visible, so a
  // digit typed right after tapping a cell is never lost.
  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      const digit = Number(event.key);
      if (event.key.length === 1 && Number.isInteger(digit) && digit <= request.max && digit !== request.banned) {
        request.onPick(digit);
        onClose();
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        request.onPick(null);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, onClose]);

  const digits = Array.from({ length: request.max + 1 }, (_, digit) => digit);
  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div className="number-pad" role="dialog" aria-label={request.title} onPointerDown={(event) => event.stopPropagation()}>
        <div className="number-pad-title">{request.title}</div>
        <div className="number-pad-grid">
          {digits.map((digit) => (
            <button
              key={digit}
              className={digit === request.value ? 'pad-key selected' : 'pad-key'}
              disabled={digit === request.banned}
              title={digit === request.banned ? 'Not allowed: the bets would add up to the cards dealt' : undefined}
              onClick={() => {
                request.onPick(digit);
                onClose();
              }}
            >
              {digit}
            </button>
          ))}
        </div>
        <div className="number-pad-actions">
          <button
            className="secondary"
            onClick={() => {
              request.onPick(null);
              onClose();
            }}
          >
            Clear
          </button>
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
