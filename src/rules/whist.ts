// Romanian Whist scoring, ported from the game:
// - Entities/Managers/WhistManager/Rules/RomanianWhistRules.gd (round plan)
// - Entities/Managers/WhistManager/Rules/CardGameRules.gd (banned bet, score, winner)
// src/rules/whist.test.ts checks this file against cases generated from those scripts.

export const WHIST_MIN_PLAYERS = 3;
export const WHIST_MAX_PLAYERS = 6;

/** Cards dealt per player in each round: n×1, 2..7, n×8, 7..2, n×1 (or the reverse starting with 8s). */
export function whistRoundPlan(playerCount: number, startWithEights = false): number[] {
  const ones = Array<number>(playerCount).fill(1);
  const eights = Array<number>(playerCount).fill(8);
  const middle = [2, 3, 4, 5, 6, 7];
  const down = [...middle].reverse();
  return startWithEights
    ? [...eights, ...down, ...ones, ...middle, ...eights]
    : [...ones, ...middle, ...eights, ...down, ...ones];
}

/**
 * The bet the last bettor may not make (so the bets can't add up to the cards
 * dealt), or null when the other bets already exceed the cards.
 */
export function bannedBet(cardsPerPlayer: number, otherBets: number[]): number | null {
  const total = otherBets.reduce((sum, bet) => sum + bet, 0);
  return total > cardsPerPlayer ? null : cardsPerPlayer - total;
}

/** 5 + bet when the bet is made exactly, otherwise minus the difference. */
export function whistRoundScore(bet: number, tricks: number): number {
  return bet === tricks ? 5 + bet : -Math.abs(bet - tricks);
}

/** Seat (0-based) that bets first in a round; it moves one seat each round. */
export function firstBettor(roundIndex: number, playerCount: number, firstSeat = 0): number {
  return (firstSeat + roundIndex) % playerCount;
}

/** Seats in betting order for a round; the last one is restricted by bannedBet. */
export function bettingOrder(roundIndex: number, playerCount: number, firstSeat = 0): number[] {
  const first = firstBettor(roundIndex, playerCount, firstSeat);
  return Array.from({ length: playerCount }, (_, offset) => (first + offset) % playerCount);
}

export interface WhistRoundEntry {
  bets: (number | null)[];
  tricks: (number | null)[];
}

export type WhistIssue =
  | { kind: 'banned-bet'; seat: number; bet: number }
  | { kind: 'bet-out-of-range'; seat: number }
  | { kind: 'tricks-out-of-range'; seat: number }
  | { kind: 'tricks-total'; expected: number; actual: number };

/** Problems with a round's entries; an empty list means it can be scored. */
export function validateWhistRound(
  entry: WhistRoundEntry,
  cardsPerPlayer: number,
  roundIndex: number,
  firstSeat = 0,
): WhistIssue[] {
  const n = entry.bets.length;
  const issues: WhistIssue[] = [];
  entry.bets.forEach((bet, seat) => {
    if (bet !== null && (bet < 0 || bet > cardsPerPlayer)) issues.push({ kind: 'bet-out-of-range', seat });
  });
  entry.tricks.forEach((tricks, seat) => {
    if (tricks !== null && (tricks < 0 || tricks > cardsPerPlayer)) issues.push({ kind: 'tricks-out-of-range', seat });
  });
  const order = bettingOrder(roundIndex, n, firstSeat);
  const lastSeat = order[n - 1];
  const lastBet = entry.bets[lastSeat];
  const others = order.slice(0, -1).map((seat) => entry.bets[seat]);
  if (lastBet !== null && others.every((bet) => bet !== null)) {
    const banned = bannedBet(cardsPerPlayer, others as number[]);
    if (banned !== null && lastBet === banned) issues.push({ kind: 'banned-bet', seat: lastSeat, bet: lastBet });
  }
  if (entry.tricks.every((tricks) => tricks !== null)) {
    const actual = (entry.tricks as number[]).reduce((sum, value) => sum + value, 0);
    if (actual !== cardsPerPlayer) issues.push({ kind: 'tricks-total', expected: cardsPerPlayer, actual });
  }
  return issues;
}

/** Score per seat for a complete, valid round; null while anything is missing. */
export function scoreWhistRound(entry: WhistRoundEntry): number[] | null {
  if (entry.bets.some((bet) => bet === null) || entry.tricks.some((tricks) => tricks === null)) return null;
  return entry.bets.map((bet, seat) => whistRoundScore(bet as number, entry.tricks[seat] as number));
}
