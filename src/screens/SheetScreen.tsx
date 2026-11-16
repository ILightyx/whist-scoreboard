import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { InputCell, ToggleCell } from '../components/InputCell';
import { NumberPad, type NumberPadRequest } from '../components/NumberPad';
import {
  type CellRef,
  commit,
  computeSheet,
  type Field,
  type Game,
  getValue,
  maxValue,
  redo,
  setContract,
  setValue,
  type SheetRow,
  startHistory,
  undo,
} from '../game/model';
import type { RentzContract } from '../rules/rentz';
import { exportGame, saveGame } from '../storage/db';
import { useI18n } from '../i18n/context';
import { describeIssue } from '../i18n/issues';

/** Stable, untranslated cell ids for data-cell/data-ink (test hooks), e.g. "Ana Bet round 1". */
const FIELD_ID: Record<Field, string> = {
  bet: 'Bet',
  tricks: 'Tricks',
  queens: 'Queens',
  diamonds: 'Diamonds',
  kingOfHearts: 'King of Hearts',
  place: 'Place',
};

export function SheetScreen({ initialGame, onExit }: { initialGame: Game; onExit: () => void }) {
  const { t } = useI18n();
  const [history, setHistory] = useState(() => startHistory(initialGame));
  const [pad, setPad] = useState<NumberPadRequest | null>(null);
  // Scrolled sideways: the first column shrinks to slim tabs at the left edge.
  const [scrolled, setScrolled] = useState(false);
  const [picker, setPicker] = useState<number | null>(null);
  const [showStandings, setShowStandings] = useState(false);
  const game = history.present;
  const sheet = useMemo(() => computeSheet(game), [game]);
  const n = game.players.length;

  // Autosave every change.
  useEffect(() => {
    void saveGame(game);
  }, [game]);

  useEffect(() => {
    if (sheet.finished) setShowStandings(true);
  }, [sheet.finished]);

  const apply = useCallback((next: Game) => setHistory((current) => commit(current, next)), []);

  const change = (cell: CellRef, value: number | null) => {
    if (getValue(game, cell) === value) return;
    apply(setValue(game, cell, value));
  };

  const cellId = (cell: CellRef) => `${game.players[cell.seat]} ${FIELD_ID[cell.field]} round ${cell.round + 1}`;
  const cellParams = (cell: CellRef) => ({ player: game.players[cell.seat], field: t(`field.${cell.field}`), round: cell.round + 1 });
  const cellLabel = (cell: CellRef) => t('sheet.cellLabel', cellParams(cell));

  const openPad = (cell: CellRef, banned: number | null) =>
    setPad({
      title: t('sheet.padTitle', cellParams(cell)),
      max: maxValue(game, cell.round, cell.field),
      value: getValue(game, cell),
      banned,
      onPick: (value) => change(cell, value),
    });

  const renderInput = (row: SheetRow, seat: number, field: Field, locked: boolean) => {
    const cell = { round: row.index, seat, field };
    const value = getValue(game, cell);
    if (field === 'kingOfHearts') {
      return (
        <ToggleCell key={field} value={value} cellId={cellId(cell)} label={cellLabel(cell)} disabled={locked} onChange={(next) => change(cell, next)} />
      );
    }
    const banned = field === 'bet' && row.banned && row.banned.seat === seat ? row.banned.bet : null;
    const hints: string[] = [];
    // Who bets first and the banned bet only matter until the bet is written.
    if (field === 'bet' && value === null && row.leadSeat === seat) hints.push(t('sheet.firstHint'));
    if (banned !== null && value === null) hints.push(`≠${banned}`);
    if (row.fields.length > 1 && field !== 'bet' && game.kind === 'rentz') hints.push(t(`fieldShort.${field}`));
    return (
      <InputCell
        key={field}
        value={value}
        max={maxValue(game, row.index, field)}
        banned={banned}
        cellId={cellId(cell)}
        label={cellLabel(cell)}
        disabled={locked}
        hint={hints.join(' ')}
        invalid={banned !== null && value === banned}
        onChange={(next) => change(cell, next)}
        onRequestPad={() => openPad(cell, banned)}
      />
    );
  };

  const contractCell = (row: SheetRow, locked: boolean) => {
    const contract = row.contract;
    return (
      <button className={contract ? 'contract-chip' : 'contract-chip empty'} disabled={locked} onClick={() => setPicker(row.index)}>
        {contract ? t(`contractShort.${contract}`) : t('sheet.choose')}
      </button>
    );
  };

  const leaderSeat = sheet.places.indexOf(1);

  return (
    <main className="sheet-screen">
      <header className="toolbar">
        <button className="secondary" onClick={onExit} aria-label={t('sheet.back')}>
          ‹<span className="label"> {t('sheet.games')}</span>
        </button>
        <h1>{t(game.kind === 'whist' ? 'kind.whist' : 'kind.rentz')}</h1>
        <div className="toolbar-actions">
          <button className="secondary" onClick={() => setHistory(undo)} disabled={!history.past.length} aria-label={t('sheet.undo')}>
            ↶<span className="label"> {t('sheet.undo')}</span>
          </button>
          <button className="secondary" onClick={() => setHistory(redo)} disabled={!history.future.length} aria-label={t('sheet.redo')}>
            ↷<span className="label"> {t('sheet.redo')}</span>
          </button>
          <button className="secondary" onClick={() => setShowStandings(true)}>
            {t('sheet.standings')}
          </button>
          <button
            className="secondary"
            onClick={() => {
              const url = URL.createObjectURL(exportGame(game));
              const link = document.createElement('a');
              link.href = url;
              link.download = `${game.kind}-${new Date(game.createdAt).toISOString().slice(0, 10)}.json`;
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            {t('sheet.export')}
          </button>
        </div>
      </header>

      <div className="sheet-scroll" onScroll={(event) => setScrolled(event.currentTarget.scrollLeft > 8)}>
        <table className={`sheet ${game.kind}${scrolled ? ' scrolled' : ''}`}>
          <thead>
            <tr>
              <th className="round-col" rowSpan={2}>
                {t(game.kind === 'whist' ? 'sheet.cards' : 'sheet.contract')}
              </th>
              {game.players.map((name, seat) => (
                <th key={name} colSpan={game.kind === 'whist' ? 3 : 2} className={seat === leaderSeat && sheet.totals.some((t) => t !== 0) ? 'player-head leader' : 'player-head'}>
                  <span className="player-name">{name}</span>
                  <span className="player-total" data-total={name}>
                    {sheet.totals[seat]}
                  </span>
                  <span className="player-place">#{sheet.places[seat]}</span>
                </th>
              ))}
            </tr>
            <tr className="subhead">
              {game.players.map((name) => (
                <Fragment key={name}>
                  {game.kind === 'whist' ? (
                    <>
                      <th>{t('field.bet')}</th>
                      <th>{t('field.tricks')}</th>
                    </>
                  ) : (
                    <th>{t('sheet.taken')}</th>
                  )}
                  <th>{t('sheet.score')}</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row) => {
              const locked = row.index > sheet.currentRound;
              const classes = [row.index === sheet.currentRound ? 'current' : '', row.complete ? 'complete' : '', locked ? 'locked' : ''];
              return (
                <Fragment key={row.index}>
                  <tr className={classes.join(' ')}>
                    <th className="round-col">
                      <span className="row-full">
                        {game.kind === 'whist' ? (
                          <span className="round-cards">{row.cards}</span>
                        ) : (
                          <>
                            <span className="chooser">{game.players[row.leadSeat]}</span>
                            {contractCell(row, locked)}
                          </>
                        )}
                      </span>
                      {/* Shown instead while scrolled sideways; a tap scrolls back. */}
                      {game.kind === 'rentz' && !row.contract && row.index !== sheet.currentRound ? null : (
                        <span
                          className="row-mini"
                          aria-hidden="true"
                          onClick={(event) => event.currentTarget.closest('.sheet-scroll')?.scrollTo({ left: 0, behavior: 'smooth' })}
                        >
                          {game.kind === 'whist' ? row.cards : row.contract ? t(`contractShort.${row.contract}`) : '?'}
                        </span>
                      )}
                    </th>
                    {game.players.map((name, seat) => (
                      <Fragment key={name}>
                        {game.kind === 'whist' ? (
                          <>
                            <td className="input-td">{renderInput(row, seat, 'bet', locked)}</td>
                            <td className="input-td">{renderInput(row, seat, 'tricks', locked)}</td>
                          </>
                        ) : (
                          <td className="input-td">
                            <div className={`entry-group fields-${row.fields.length}`}>
                              {row.fields.length ? row.fields.map((field) => renderInput(row, seat, field, locked)) : <span className="muted">—</span>}
                            </div>
                          </td>
                        )}
                        <td className="score-td" data-score={`${name} round ${row.index + 1}`}>
                          {row.scores ? (
                            <>
                              <span className={row.scores[seat] < 0 ? 'delta negative' : 'delta'}>
                                {row.scores[seat] > 0 ? '+' : ''}
                                {row.scores[seat]}
                              </span>
                              <span className="running">{row.totals[seat]}</span>
                            </>
                          ) : null}
                        </td>
                      </Fragment>
                    ))}
                  </tr>
                  {row.issues.length ? (
                    <tr className="issue-row">
                      <td colSpan={1 + n * (game.kind === 'whist' ? 3 : 2)}>{row.issues.map((issue) => describeIssue(t, issue, game.players)).join(' ')}</td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {game.kind === 'whist' && game.zeroWins ? <p className="footnote muted">{t('sheet.zeroWinsRule')}</p> : null}

      {game.kind === 'rentz' && sheet.rows.some((row) => row.contract === 'big-totals' || row.contract === 'small-totals') ? (
        <p className="footnote muted">{t('sheet.totals')}</p>
      ) : null}

      {pad ? <NumberPad request={pad} onClose={() => setPad(null)} /> : null}

      {picker !== null && game.kind === 'rentz' ? (
        <div className="modal-backdrop" onPointerDown={() => setPicker(null)}>
          <div className="dialog" role="dialog" aria-label={t('sheet.chooseContract')} onPointerDown={(event) => event.stopPropagation()}>
            <h2>{t('sheet.chooses', { name: game.players[sheet.rows[picker].leadSeat] })}</h2>
            <div className="contract-grid">
              {(sheet.rows[picker].availableContracts ?? []).map((contract: RentzContract) => (
                <button
                  key={contract}
                  className={sheet.rows[picker].contract === contract ? 'contract-option on' : 'contract-option'}
                  onClick={() => {
                    if (game.kind === 'rentz' && sheet.rows[picker].contract !== contract) apply(setContract(game, picker, contract));
                    setPicker(null);
                  }}
                >
                  <strong>{t(`contract.${contract}`)}</strong>
                  <small>{t(`contractShort.${contract}`)}</small>
                </button>
              ))}
            </div>
            <div className="dialog-actions">
              <button className="secondary" onClick={() => setPicker(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showStandings ? (
        <div className="modal-backdrop" onPointerDown={() => setShowStandings(false)}>
          <div className="dialog standings" role="dialog" aria-label={t('sheet.standings')} onPointerDown={(event) => event.stopPropagation()}>
            <h2>{sheet.finished ? t('sheet.finalStandings') : t('sheet.standingsAfter', { round: sheet.currentRound })}</h2>
            {sheet.finished && game.kind === 'whist' && game.zeroWins ? (
              <p className="muted">{t(sheet.wonOnZero ? 'sheet.wonOnZero' : 'sheet.nobodyOnZero')}</p>
            ) : null}
            <ol>
              {game.players
                .map((name, seat) => ({ name, total: sheet.totals[seat], place: sheet.places[seat] }))
                .sort((a, b) => a.place - b.place)
                .map((entry) => (
                  <li key={entry.name} className={entry.place === 1 ? 'winner' : ''}>
                    <span className="place">{entry.place}.</span>
                    <span className="name">{entry.name}</span>
                    <span className="total">{entry.total}</span>
                  </li>
                ))}
            </ol>
            <div className="dialog-actions">
              <button
                className="secondary"
                onClick={() => {
                  const text = game.players
                    .map((name, seat) => ({ name, total: sheet.totals[seat], place: sheet.places[seat] }))
                    .sort((a, b) => a.place - b.place)
                    .map((entry) => `${entry.place}. ${entry.name} ${entry.total}`)
                    .join('\n');
                  void navigator.clipboard?.writeText(text);
                }}
              >
                {t('sheet.copy')}
              </button>
              <button className="primary" onClick={() => setShowStandings(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
