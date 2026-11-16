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
import { RENTZ_CONTRACT_INFO, type RentzContract } from '../rules/rentz';
import { exportGame, saveGame } from '../storage/db';

const FIELD_LABEL: Record<Field, string> = {
  bet: 'Bet',
  tricks: 'Tricks',
  queens: 'Queens',
  diamonds: 'Diamonds',
  kingOfHearts: 'King of Hearts',
  place: 'Place',
};
const FIELD_SHORT: Partial<Record<Field, string>> = { tricks: 'T', queens: 'Q', diamonds: '♦', kingOfHearts: 'K♥', place: '#' };

export function SheetScreen({ initialGame, onExit }: { initialGame: Game; onExit: () => void }) {
  const [history, setHistory] = useState(() => startHistory(initialGame));
  const [pad, setPad] = useState<NumberPadRequest | null>(null);
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

  const cellLabel = (cell: CellRef) => `${game.players[cell.seat]} ${FIELD_LABEL[cell.field]} round ${cell.round + 1}`;

  const openPad = (cell: CellRef, banned: number | null) =>
    setPad({
      title: `${game.players[cell.seat]} · ${FIELD_LABEL[cell.field]} · round ${cell.round + 1}`,
      max: maxValue(game, cell.round, cell.field),
      value: getValue(game, cell),
      banned,
      onPick: (value) => change(cell, value),
    });

  const renderInput = (row: SheetRow, seat: number, field: Field, locked: boolean) => {
    const cell = { round: row.index, seat, field };
    const value = getValue(game, cell);
    if (field === 'kingOfHearts') {
      return <ToggleCell key={field} value={value} label={cellLabel(cell)} disabled={locked} onChange={(next) => change(cell, next)} />;
    }
    const banned = field === 'bet' && row.banned && row.banned.seat === seat ? row.banned.bet : null;
    const hints: string[] = [];
    if (field === 'bet' && row.leadSeat === seat) hints.push('1st');
    if (banned !== null) hints.push(`≠${banned}`);
    if (row.fields.length > 1 && FIELD_SHORT[field] && game.kind === 'rentz') hints.push(FIELD_SHORT[field]!);
    return (
      <InputCell
        key={field}
        value={value}
        max={maxValue(game, row.index, field)}
        banned={banned}
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
        {contract ? RENTZ_CONTRACT_INFO[contract].short : 'Choose'}
      </button>
    );
  };

  const leaderSeat = sheet.places.indexOf(1);

  return (
    <main className="sheet-screen">
      <header className="toolbar">
        <button className="secondary" onClick={onExit} aria-label="Back to games">
          ‹ Games
        </button>
        <h1>{game.kind === 'whist' ? 'Romanian Whist' : 'Rentz'}</h1>
        <div className="toolbar-actions">
          <button className="secondary" onClick={() => setHistory(undo)} disabled={!history.past.length} aria-label="Undo">
            ↶ Undo
          </button>
          <button className="secondary" onClick={() => setHistory(redo)} disabled={!history.future.length} aria-label="Redo">
            ↷ Redo
          </button>
          <button className="secondary" onClick={() => setShowStandings(true)}>
            Standings
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
            Export
          </button>
        </div>
      </header>

      <div className="sheet-scroll">
        <table className={`sheet ${game.kind}`}>
          <thead>
            <tr>
              <th className="round-col" rowSpan={2}>
                {game.kind === 'whist' ? 'Cards' : 'Contract'}
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
                      <th>Bet</th>
                      <th>Tricks</th>
                    </>
                  ) : (
                    <th>Taken</th>
                  )}
                  <th>Score</th>
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
                      {game.kind === 'whist' ? (
                        <span className="round-cards">{row.cards}</span>
                      ) : (
                        <>
                          <span className="chooser">{game.players[row.leadSeat]}</span>
                          {contractCell(row, locked)}
                        </>
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
                      <td colSpan={1 + n * (game.kind === 'whist' ? 3 : 2)}>{row.issues.join(' ')}</td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {game.kind === 'rentz' && sheet.rows.some((row) => row.contract === 'big-totals' || row.contract === 'small-totals') ? (
        <p className="footnote muted">Totals: the Q♦ counts as both a queen and a diamond, as in the game.</p>
      ) : null}

      {pad ? <NumberPad request={pad} onClose={() => setPad(null)} /> : null}

      {picker !== null && game.kind === 'rentz' ? (
        <div className="modal-backdrop" onPointerDown={() => setPicker(null)}>
          <div className="dialog" role="dialog" aria-label="Choose contract" onPointerDown={(event) => event.stopPropagation()}>
            <h2>{game.players[sheet.rows[picker].leadSeat]} chooses</h2>
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
                  <strong>{RENTZ_CONTRACT_INFO[contract].name}</strong>
                  <small>{RENTZ_CONTRACT_INFO[contract].short}</small>
                </button>
              ))}
            </div>
            <div className="dialog-actions">
              <button className="secondary" onClick={() => setPicker(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showStandings ? (
        <div className="modal-backdrop" onPointerDown={() => setShowStandings(false)}>
          <div className="dialog standings" role="dialog" aria-label="Standings" onPointerDown={(event) => event.stopPropagation()}>
            <h2>{sheet.finished ? 'Final standings' : `Standings after round ${sheet.currentRound}`}</h2>
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
                Copy
              </button>
              <button className="primary" onClick={() => setShowStandings(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
