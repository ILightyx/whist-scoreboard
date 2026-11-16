// Rentz scoring, ported from Entities/Managers/WhistManager/Rules/RentzRules.gd.
// With real cards, players enter counts (tricks, queens, ...) instead of cards;
// src/rules/rentz.test.ts checks these formulas against the game's per-trick scoring.

export const RENTZ_MIN_PLAYERS = 4;
export const RENTZ_MAX_PLAYERS = 6;
export const RENTZ_TRICKS_PER_ROUND = 8;
export const RENTZ_QUEENS = 4;

/**
 * Point values of the rules resource the game uses
 * (Entities/Managers/WhistManager/Rules/RentzRules.tres, which overrides the
 * script defaults). The fixture test checks them against the game.
 */
export const RENTZ_POINTS = {
  trick: 10,
  queen: 25,
  diamond: 20,
  kingOfHearts: 300,
  rentzBase: 100,
} as const;

/** Same order and IDs as RentzRules.RentzMode. */
export const RENTZ_CONTRACTS = [
  'small-bids',
  'big-bids',
  'queens',
  'diamonds',
  'king-of-hearts',
  'big-totals',
  'small-totals',
  'rentz',
] as const;
export type RentzContract = (typeof RENTZ_CONTRACTS)[number];

/** Whether a contract's points count for (+1) or against (-1) the player. Names live in src/i18n. */
export const RENTZ_CONTRACT_SIGN: Record<RentzContract, -1 | 0 | 1> = {
  'small-bids': -1,
  'big-bids': 1,
  queens: -1,
  diamonds: -1,
  'king-of-hearts': -1,
  'big-totals': 1,
  'small-totals': -1,
  rentz: 0,
};

/** What a contract asks each player to enter. */
export type RentzField = 'tricks' | 'queens' | 'diamonds' | 'kingOfHearts' | 'place';

export function rentzContractFields(contract: RentzContract): RentzField[] {
  switch (contract) {
    case 'small-bids':
    case 'big-bids':
      return ['tricks'];
    case 'queens':
      return ['queens'];
    case 'diamonds':
      return ['diamonds'];
    case 'king-of-hearts':
      return ['kingOfHearts'];
    case 'big-totals':
    case 'small-totals':
      return ['tricks', 'queens', 'diamonds', 'kingOfHearts'];
    case 'rentz':
      return ['place'];
  }
}

/** The deck is players × 8 cards from the top ranks: two ranks per player, one diamond each. */
export function rentzDiamondsInDeck(playerCount: number): number {
  return playerCount * 2;
}

export function rentzRoundCount(playerCount: number): number {
  return playerCount * RENTZ_CONTRACTS.length;
}

/** Seat (0-based) that chooses the contract (and leads) in a round. */
export function rentzChooser(roundIndex: number, playerCount: number, firstSeat = 0): number {
  return (firstSeat + roundIndex) % playerCount;
}

export interface RentzPlayerCounts {
  tricks?: number | null;
  queens?: number | null;
  diamonds?: number | null;
  /** 1 if this player took the King of Hearts, else 0. */
  kingOfHearts?: number | null;
  /** Finishing place in the Rentz contract, 1 = first out. */
  place?: number | null;
}

/** One player's score for a contract, from their counts. */
export function rentzPlayerScore(contract: RentzContract, counts: RentzPlayerCounts, playerCount: number): number {
  // `+ 0` turns -0 (a negative sign times zero) into 0.
  return rawRentzPlayerScore(contract, counts, playerCount) + 0;
}

function rawRentzPlayerScore(contract: RentzContract, counts: RentzPlayerCounts, playerCount: number): number {
  const sign = RENTZ_CONTRACT_SIGN[contract];
  const tricks = counts.tricks ?? 0;
  const queens = counts.queens ?? 0;
  const diamonds = counts.diamonds ?? 0;
  const kingOfHearts = counts.kingOfHearts ?? 0;
  switch (contract) {
    case 'small-bids':
    case 'big-bids':
      return sign * RENTZ_POINTS.trick * tricks;
    case 'queens':
      return sign * RENTZ_POINTS.queen * queens;
    case 'diamonds':
      return sign * RENTZ_POINTS.diamond * diamonds;
    case 'king-of-hearts':
      return sign * RENTZ_POINTS.kingOfHearts * kingOfHearts;
    case 'big-totals':
    case 'small-totals':
      return (
        sign *
        (RENTZ_POINTS.trick * tricks +
          RENTZ_POINTS.queen * queens +
          RENTZ_POINTS.diamond * diamonds +
          RENTZ_POINTS.kingOfHearts * kingOfHearts)
      );
    case 'rentz':
      return rentzFinishScore(counts.place ?? 0, playerCount);
  }
}

/** Last place gets 0; each place above last earns another 100 (calculate_sorting_finish_score). */
export function rentzFinishScore(place: number, playerCount: number): number {
  if (place <= 0 || playerCount <= 0) return 0;
  return Math.max(playerCount - place, 0) * RENTZ_POINTS.rentzBase;
}

export type RentzIssue =
  | { kind: 'total'; field: RentzField; expected: number; actual: number }
  | { kind: 'king-of-hearts-count'; actual: number }
  | { kind: 'places'; detail: 'duplicate' | 'out-of-range' };

/** Problems with a complete round's counts; an empty list means it can be scored. */
export function validateRentzRound(contract: RentzContract, counts: RentzPlayerCounts[]): RentzIssue[] {
  const n = counts.length;
  const fields = rentzContractFields(contract);
  const issues: RentzIssue[] = [];
  const sum = (field: RentzField) => counts.reduce((total, player) => total + (player[field] ?? 0), 0);
  const complete = (field: RentzField) => counts.every((player) => player[field] !== null && player[field] !== undefined);
  if (fields.includes('tricks') && complete('tricks') && sum('tricks') !== RENTZ_TRICKS_PER_ROUND) {
    issues.push({ kind: 'total', field: 'tricks', expected: RENTZ_TRICKS_PER_ROUND, actual: sum('tricks') });
  }
  if (fields.includes('queens') && complete('queens') && sum('queens') !== RENTZ_QUEENS) {
    issues.push({ kind: 'total', field: 'queens', expected: RENTZ_QUEENS, actual: sum('queens') });
  }
  if (fields.includes('diamonds') && complete('diamonds') && sum('diamonds') !== rentzDiamondsInDeck(n)) {
    issues.push({ kind: 'total', field: 'diamonds', expected: rentzDiamondsInDeck(n), actual: sum('diamonds') });
  }
  if (fields.includes('kingOfHearts') && complete('kingOfHearts') && sum('kingOfHearts') !== 1) {
    issues.push({ kind: 'king-of-hearts-count', actual: sum('kingOfHearts') });
  }
  if (fields.includes('place') && complete('place')) {
    const places = counts.map((player) => player.place as number);
    if (places.some((place) => place < 1 || place > n)) issues.push({ kind: 'places', detail: 'out-of-range' });
    else if (new Set(places).size !== n) issues.push({ kind: 'places', detail: 'duplicate' });
  }
  return issues;
}

/** True when every field the contract needs has a value for every player. */
export function isRentzRoundComplete(contract: RentzContract, counts: RentzPlayerCounts[]): boolean {
  return rentzContractFields(contract).every((field) =>
    counts.every((player) => player[field] !== null && player[field] !== undefined),
  );
}
