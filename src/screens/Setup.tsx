import { useMemo, useState } from 'react';
import { createRentzGame, createWhistGame, type Game, type GameKind } from '../game/model';
import { RENTZ_MAX_PLAYERS, RENTZ_MIN_PLAYERS } from '../rules/rentz';
import { WHIST_MAX_PLAYERS, WHIST_MIN_PLAYERS } from '../rules/whist';
import { recentNames } from '../storage/db';
import { useT } from '../i18n/context';

const LIMITS: Record<GameKind, [number, number]> = {
  whist: [WHIST_MIN_PLAYERS, WHIST_MAX_PLAYERS],
  rentz: [RENTZ_MIN_PLAYERS, RENTZ_MAX_PLAYERS],
};

/** One screen: game, players (in seating order), who starts, Start. */
export function Setup({ onStart, onCancel }: { onStart: (game: Game) => void; onCancel: () => void }) {
  const t = useT();
  const [kind, setKind] = useState<GameKind>('whist');
  const [names, setNames] = useState<string[]>(() => {
    const recent = recentNames();
    return Array.from({ length: 4 }, (_, index) => recent[index] ?? '');
  });
  const [firstSeat, setFirstSeat] = useState(0);
  const [startWithEights, setStartWithEights] = useState(false);
  const [zeroWins, setZeroWins] = useState(false);
  const suggestions = useMemo(recentNames, []);
  const [min, max] = LIMITS[kind];

  const setCount = (count: number) => {
    const clamped = Math.max(min, Math.min(max, count));
    setNames((current) => Array.from({ length: clamped }, (_, index) => current[index] ?? suggestions[index] ?? ''));
    setFirstSeat((seat) => Math.min(seat, clamped - 1));
  };

  const chooseKind = (next: GameKind) => {
    setKind(next);
    const [nextMin, nextMax] = LIMITS[next];
    if (names.length < nextMin || names.length > nextMax) {
      const count = Math.max(nextMin, Math.min(nextMax, names.length));
      setNames((current) => Array.from({ length: count }, (_, index) => current[index] ?? suggestions[index] ?? ''));
    }
  };

  const players = names.map((name, index) => name.trim() || t('setup.defaultName', { n: index + 1 }));
  const duplicate = new Set(players).size !== players.length;

  return (
    <main className="setup">
      <h1>{t('setup.title')}</h1>
      <div className="segmented" role="radiogroup" aria-label={t('setup.game')}>
        {(['whist', 'rentz'] as GameKind[]).map((option) => (
          <button key={option} role="radio" aria-checked={kind === option} className={kind === option ? 'on' : ''} onClick={() => chooseKind(option)}>
            {t(option === 'whist' ? 'kind.whist' : 'kind.rentz')}
          </button>
        ))}
      </div>

      <section className="setup-players">
        <div className="setup-row">
          <h2>{t('setup.players')}</h2>
          <div className="stepper" aria-label={t('setup.playerCount')}>
            <button aria-label={t('setup.fewer')} disabled={names.length <= min} onClick={() => setCount(names.length - 1)}>
              −
            </button>
            <span>{names.length}</span>
            <button aria-label={t('setup.more')} disabled={names.length >= max} onClick={() => setCount(names.length + 1)}>
              +
            </button>
          </div>
        </div>
        <p className="muted">{t(kind === 'whist' ? 'setup.seatingWhist' : 'setup.seatingRentz')}</p>
        <datalist id="recent-names">
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <ol className="name-list">
          {names.map((name, index) => (
            <li key={index}>
              <input
                className="name-input"
                value={name}
                placeholder={t('setup.defaultName', { n: index + 1 })}
                list="recent-names"
                autoComplete="off"
                aria-label={t('setup.nameLabel', { n: index + 1 })}
                onChange={(event) => setNames((current) => current.map((value, i) => (i === index ? event.target.value : value)))}
              />
              <button className={firstSeat === index ? 'first-seat on' : 'first-seat'} aria-pressed={firstSeat === index} onClick={() => setFirstSeat(index)}>
                {t(firstSeat === index ? 'setup.starts' : 'setup.startHere')}
              </button>
            </li>
          ))}
        </ol>
        {duplicate ? <p className="warning">{t('setup.duplicate')}</p> : null}
      </section>

      {kind === 'whist' ? (
        <>
          <label className="check">
            <input type="checkbox" checked={startWithEights} onChange={(event) => setStartWithEights(event.target.checked)} />
            <span>{t('setup.startWithEights')}</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={zeroWins} onChange={(event) => setZeroWins(event.target.checked)} />
            <span>
              {t('setup.zeroWins')}
              <small className="muted">{t('setup.zeroWinsHelp')}</small>
            </span>
          </label>
        </>
      ) : (
        <p className="muted">{t('setup.rentzRounds', { count: names.length * 8 })}</p>
      )}

      <div className="setup-actions">
        <button className="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button
          className="primary big"
          disabled={duplicate}
          onClick={() =>
            onStart(kind === 'whist' ? createWhistGame(players, firstSeat, startWithEights, zeroWins) : createRentzGame(players, firstSeat))
          }
        >
          {t('setup.start')}
        </button>
      </div>
    </main>
  );
}
