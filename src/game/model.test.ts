import { describe, expect, it } from 'vitest';
import {
  commit,
  computeSheet,
  createRentzGame,
  createWhistGame,
  type Game,
  maxValue,
  redo,
  setContract,
  setValue,
  startHistory,
  undo,
} from './model';
import { RENTZ_CONTRACTS } from '../rules/rentz';
import { describeIssue } from '../i18n/issues';
import { translator } from '../i18n/translate';

/** The first round's issues as English sentences. */
const issueText = (game: Game) => computeSheet(game).rows[0].issues.map((issue) => describeIssue(translator('en'), issue, game.players));

function fillWhistRound(game: Game, round: number, bets: number[], tricks: number[]): Game {
  let next = game;
  bets.forEach((bet, seat) => (next = setValue(next, { round, seat, field: 'bet' }, bet)));
  tricks.forEach((value, seat) => (next = setValue(next, { round, seat, field: 'tricks' }, value)));
  return next;
}

describe('Whist sheet', () => {
  it('has one row per planned round and scores completed rounds', () => {
    let game: Game = createWhistGame(['Ana', 'Bob', 'Cris', 'Dan'], 0, false);
    expect(computeSheet(game).rows).toHaveLength(4 + 6 + 4 + 6 + 4);
    game = fillWhistRound(game, 0, [1, 0, 0, 1], [1, 0, 0, 0]);
    const sheet = computeSheet(game);
    expect(sheet.rows[0].scores).toEqual([6, 5, 5, -1]);
    expect(sheet.totals).toEqual([6, 5, 5, -1]);
    expect(sheet.places).toEqual([1, 2, 2, 4]);
    expect(sheet.currentRound).toBe(1);
  });

  it('shows the banned last bet and refuses to score it', () => {
    let game: Game = createWhistGame(['Ana', 'Bob', 'Cris', 'Dan'], 0, false);
    game = fillWhistRound(game, 0, [0, 0, 0], []);
    expect(computeSheet(game).rows[0].banned).toEqual({ seat: 3, bet: 1 });
    game = fillWhistRound(game, 0, [0, 0, 0, 1], [0, 0, 0, 1]);
    expect(issueText(game)).toEqual(["Dan bets last and can't bet 1."]);
    expect(computeSheet(game).rows[0].scores).toBeNull();
  });

  it('flags tricks that do not add up', () => {
    const game = fillWhistRound(createWhistGame(['A', 'B', 'C'], 1, false), 0, [0, 1, 1], [1, 1, 0]);
    expect(issueText(game)).toEqual(['Tricks add up to 2, not 1.']);
  });

  it('limits values to the cards dealt', () => {
    const game = createWhistGame(['A', 'B', 'C', 'D'], 0, false);
    expect(maxValue(game, 0, 'bet')).toBe(1);
    expect(maxValue(game, 10, 'tricks')).toBe(8);
  });
});

describe('Rentz sheet', () => {
  it('offers each chooser only their unplayed contracts', () => {
    let game: Game = createRentzGame(['A', 'B', 'C', 'D'], 0);
    expect(computeSheet(game).rows).toHaveLength(32);
    game = setContract(game, 0, 'queens');
    const rows = computeSheet(game).rows;
    expect(rows[4].leadSeat).toBe(0);
    expect(rows[4].availableContracts).not.toContain('queens');
    expect(rows[1].availableContracts).toEqual([...RENTZ_CONTRACTS]);
  });

  it('scores a round from counts once it adds up', () => {
    let game: Game = setContract(createRentzGame(['A', 'B', 'C', 'D'], 0), 0, 'queens');
    [2, 1, 1].forEach((queens, seat) => (game = setValue(game, { round: 0, seat, field: 'queens' }, queens)));
    expect(computeSheet(game).rows[0].complete).toBe(false);
    game = setValue(game, { round: 0, seat: 3, field: 'queens' }, 1);
    expect(issueText(game)).toEqual(['Queens add up to 5, not 4.']);
    game = setValue(game, { round: 0, seat: 3, field: 'queens' }, 0);
    expect(computeSheet(game).rows[0].scores).toEqual([-50, -25, -25, 0]);
  });

  it('marks only one King of Hearts taker', () => {
    let game: Game = setContract(createRentzGame(['A', 'B', 'C', 'D'], 0), 0, 'king-of-hearts');
    game = setValue(game, { round: 0, seat: 1, field: 'kingOfHearts' }, 1);
    game = setValue(game, { round: 0, seat: 2, field: 'kingOfHearts' }, 1);
    expect(computeSheet(game).rows[0].scores).toEqual([0, 0, -300, 0]);
  });
});

describe('Undo and redo', () => {
  it('steps back and forward through edits', () => {
    const start = createWhistGame(['A', 'B', 'C'], 0, false);
    let history = startHistory(start);
    history = commit(history, setValue(history.present, { round: 0, seat: 0, field: 'bet' }, 1));
    history = commit(history, setValue(history.present, { round: 0, seat: 1, field: 'bet' }, 0));
    history = undo(history);
    expect(history.present.kind === 'whist' && history.present.rounds[0].bets).toEqual([1, null, null]);
    history = redo(history);
    expect(history.present.kind === 'whist' && history.present.rounds[0].bets).toEqual([1, 0, null]);
  });
});
