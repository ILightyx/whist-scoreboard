// A score-sheet game: the data a table enters, and the sheet derived from it.
// Pure functions only; the UI and storage build on these.

import {
  RENTZ_CONTRACTS,
  RENTZ_QUEENS,
  RENTZ_TRICKS_PER_ROUND,
  type RentzContract,
  type RentzField,
  type RentzPlayerCounts,
  isRentzRoundComplete,
  rentzChooser,
  rentzContractFields,
  rentzDiamondsInDeck,
  rentzPlayerScore,
  rentzRoundCount,
  validateRentzRound,
} from '../rules/rentz';
import { places, zeroWinsPlaces } from '../rules/standings';
import {
  bannedBet,
  bettingOrder,
  scoreWhistRound,
  validateWhistRound,
  whistRoundPlan,
} from '../rules/whist';

export type GameKind = 'whist' | 'rentz';

export interface WhistRound {
  bets: (number | null)[];
  tricks: (number | null)[];
}

export interface RentzRound {
  contract: RentzContract | null;
  counts: RentzPlayerCounts[];
}

interface GameBase {
  id: string;
  players: string[];
  /** Seat that bets first (Whist) or chooses first (Rentz) in round 1. */
  firstSeat: number;
  createdAt: number;
  updatedAt: number;
}

export interface WhistGame extends GameBase {
  kind: 'whist';
  startWithEights: boolean;
  /** House rule: a player who ends on exactly 0 points wins. Missing in older saves. */
  zeroWins?: boolean;
  rounds: WhistRound[];
}

export interface RentzGame extends GameBase {
  kind: 'rentz';
  rounds: RentzRound[];
}

export type Game = WhistGame | RentzGame;

/** Every input on the sheet is addressed by round, seat and field. */
export type Field = 'bet' | 'tricks' | RentzField;

export interface CellRef {
  round: number;
  seat: number;
  field: Field;
}

export function newGameId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createWhistGame(players: string[], firstSeat: number, startWithEights: boolean, zeroWins = false, now = Date.now()): WhistGame {
  const plan = whistRoundPlan(players.length, startWithEights);
  return {
    id: newGameId(),
    kind: 'whist',
    players,
    firstSeat,
    startWithEights,
    zeroWins,
    createdAt: now,
    updatedAt: now,
    rounds: plan.map(() => ({ bets: players.map(() => null), tricks: players.map(() => null) })),
  };
}

export function createRentzGame(players: string[], firstSeat: number, now = Date.now()): RentzGame {
  return {
    id: newGameId(),
    kind: 'rentz',
    players,
    firstSeat,
    createdAt: now,
    updatedAt: now,
    rounds: Array.from({ length: rentzRoundCount(players.length) }, () => ({
      contract: null,
      counts: players.map(() => ({})),
    })),
  };
}

// --- Derived sheet ----------------------------------------------------------

/** Why a round can't be scored yet; turned into text in the user's language by src/i18n/issues.ts. */
export type SheetIssue =
  | { kind: 'banned-bet'; seat: number; bet: number }
  | { kind: 'tricks-total'; actual: number; expected: number }
  | { kind: 'bet-too-high'; seat: number; max: number }
  | { kind: 'tricks-too-high'; seat: number; max: number }
  | { kind: 'rentz-total'; field: 'tricks' | 'queens' | 'diamonds'; actual: number; expected: number }
  | { kind: 'king-of-hearts'; count: number }
  | { kind: 'places-duplicate' }
  | { kind: 'places-range'; max: number };

export interface SheetRow {
  index: number;
  /** Seat that bets first (Whist) or chooses the contract (Rentz). */
  leadSeat: number;
  /** Cards per player (Whist). */
  cards?: number;
  contract?: RentzContract | null;
  /** Contracts the chooser may still pick (Rentz). */
  availableContracts?: RentzContract[];
  /** Fields each player enters this round. */
  fields: Field[];
  complete: boolean;
  issues: SheetIssue[];
  /** Score per seat, once the round is complete and valid. */
  scores: number[] | null;
  /** Running totals after this round. */
  totals: number[];
  /** The last bettor's banned bet (Whist). */
  banned?: { seat: number; bet: number } | null;
}

export interface Sheet {
  rows: SheetRow[];
  totals: number[];
  places: number[];
  /** The game ended and the "0 points wins" rule decided the winner. */
  wonOnZero: boolean;
  /** First round that is not complete, or rows.length when the game is over. */
  currentRound: number;
  finished: boolean;
}

export function computeSheet(game: Game): Sheet {
  return game.kind === 'whist' ? computeWhistSheet(game) : computeRentzSheet(game);
}

function computeWhistSheet(game: WhistGame): Sheet {
  const n = game.players.length;
  const plan = whistRoundPlan(n, game.startWithEights);
  let totals = Array<number>(n).fill(0);
  const rows: SheetRow[] = plan.map((cards, index) => {
    const round = game.rounds[index];
    const order = bettingOrder(index, n, game.firstSeat);
    const lastSeat = order[n - 1];
    const otherBets = order.slice(0, -1).map((seat) => round.bets[seat]);
    const banned = otherBets.every((bet) => bet !== null) ? bannedBet(cards, otherBets as number[]) : null;
    const issues = validateWhistRound(round, cards, index, game.firstSeat).map((issue): SheetIssue => {
      switch (issue.kind) {
        case 'banned-bet':
          return { kind: 'banned-bet', seat: issue.seat, bet: issue.bet };
        case 'tricks-total':
          return { kind: 'tricks-total', actual: issue.actual, expected: issue.expected };
        case 'bet-out-of-range':
          return { kind: 'bet-too-high', seat: issue.seat, max: cards };
        case 'tricks-out-of-range':
          return { kind: 'tricks-too-high', seat: issue.seat, max: cards };
      }
    });
    const scores = issues.length === 0 ? scoreWhistRound(round) : null;
    if (scores) totals = totals.map((total, seat) => total + scores[seat]);
    return {
      index,
      leadSeat: order[0],
      cards,
      fields: ['bet', 'tricks'],
      complete: scores !== null,
      issues,
      scores,
      totals,
      banned: banned === null ? null : { seat: lastSeat, bet: banned },
    };
  });
  return finishSheet(rows, n, game.zeroWins === true);
}

function computeRentzSheet(game: RentzGame): Sheet {
  const n = game.players.length;
  let totals = Array<number>(n).fill(0);
  const played: Set<RentzContract>[] = game.players.map(() => new Set());
  const rows: SheetRow[] = game.rounds.map((round, index) => {
    const chooser = rentzChooser(index, n, game.firstSeat);
    const available = RENTZ_CONTRACTS.filter((contract) => !played[chooser].has(contract) || contract === round.contract);
    if (round.contract) played[chooser].add(round.contract);
    const contract = round.contract;
    const fields: Field[] = contract ? rentzContractFields(contract) : [];
    const complete = contract !== null && isRentzRoundComplete(contract, round.counts);
    const issues = contract
      ? validateRentzRound(contract, round.counts).map((issue): SheetIssue => {
          switch (issue.kind) {
            case 'total':
              return { kind: 'rentz-total', field: issue.field as 'tricks' | 'queens' | 'diamonds', actual: issue.actual, expected: issue.expected };
            case 'king-of-hearts-count':
              return { kind: 'king-of-hearts', count: issue.actual };
            case 'places':
              return issue.detail === 'duplicate' ? { kind: 'places-duplicate' } : { kind: 'places-range', max: n };
          }
        })
      : [];
    const scores = complete && issues.length === 0 ? round.counts.map((counts) => rentzPlayerScore(contract!, counts, n)) : null;
    if (scores) totals = totals.map((total, seat) => total + scores[seat]);
    return {
      index,
      leadSeat: chooser,
      contract,
      availableContracts: available,
      fields,
      complete: scores !== null,
      issues,
      scores,
      totals,
    };
  });
  return finishSheet(rows, n);
}

function finishSheet(rows: SheetRow[], playerCount: number, zeroWins = false): Sheet {
  const totals = rows.length ? rows.reduce((last, row) => (row.scores ? row.totals : last), Array<number>(playerCount).fill(0)) : [];
  const currentRound = rows.findIndex((row) => !row.complete);
  // The house rule only decides the final result; during play standings are by total.
  const zeroRuleApplies = zeroWins && currentRound === -1;
  return {
    rows,
    totals,
    places: zeroRuleApplies ? zeroWinsPlaces(totals) : places(totals),
    wonOnZero: zeroRuleApplies && totals.includes(0),
    currentRound: currentRound === -1 ? rows.length : currentRound,
    finished: currentRound === -1,
  };
}

// --- Editing ----------------------------------------------------------------

/** Largest value a cell accepts (for the number pad and handwriting). */
export function maxValue(game: Game, round: number, field: Field): number {
  const n = game.players.length;
  if (game.kind === 'whist') return whistRoundPlan(n, game.startWithEights)[round];
  switch (field) {
    case 'tricks':
      return RENTZ_TRICKS_PER_ROUND;
    case 'queens':
      return RENTZ_QUEENS;
    case 'diamonds':
      return rentzDiamondsInDeck(n);
    case 'kingOfHearts':
      return 1;
    case 'place':
      return n;
    default:
      return 9;
  }
}

export function getValue(game: Game, cell: CellRef): number | null {
  if (game.kind === 'whist') {
    const round = game.rounds[cell.round];
    return (cell.field === 'bet' ? round.bets : round.tricks)[cell.seat] ?? null;
  }
  const value = game.rounds[cell.round].counts[cell.seat][cell.field as RentzField];
  return value ?? null;
}

/** Returns a new game with one cell changed (null clears it). */
export function setValue(game: Game, cell: CellRef, value: number | null, now = Date.now()): Game {
  if (game.kind === 'whist') {
    const rounds = game.rounds.map((round, index) => {
      if (index !== cell.round) return round;
      const key = cell.field === 'bet' ? 'bets' : 'tricks';
      const values = [...round[key]];
      values[cell.seat] = value;
      return { ...round, [key]: values };
    });
    return { ...game, rounds, updatedAt: now };
  }
  const rounds = game.rounds.map((round, index) => {
    if (index !== cell.round) return round;
    let counts = round.counts.map((counts, seat) => (seat === cell.seat ? { ...counts, [cell.field]: value } : counts));
    // Only one player can take the King of Hearts: marking one clears the others.
    if (cell.field === 'kingOfHearts' && value === 1) {
      counts = counts.map((counts, seat) => ({ ...counts, kingOfHearts: seat === cell.seat ? 1 : 0 }));
    }
    return { ...round, counts };
  });
  return { ...game, rounds, updatedAt: now };
}

/** Chooses (or changes) a Rentz round's contract; entries that no longer apply are cleared. */
export function setContract(game: RentzGame, round: number, contract: RentzContract | null, now = Date.now()): RentzGame {
  const rounds = game.rounds.map((entry, index) =>
    index === round ? { contract, counts: game.players.map(() => ({})) } : entry,
  );
  return { ...game, rounds, updatedAt: now };
}

// --- Undo / redo --------------------------------------------------------------

export interface History {
  past: Game[];
  present: Game;
  future: Game[];
}

export function startHistory(game: Game): History {
  return { past: [], present: game, future: [] };
}

export function commit(history: History, next: Game, limit = 200): History {
  return { past: [...history.past, history.present].slice(-limit), present: next, future: [] };
}

export function undo(history: History): History {
  if (!history.past.length) return history;
  const previous = history.past[history.past.length - 1];
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redo(history: History): History {
  if (!history.future.length) return history;
  return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) };
}
