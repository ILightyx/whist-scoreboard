/** Seat with the highest total; the first such seat on ties (CardGameRules.get_game_winner). */
export function leaderSeat(totals: number[]): number {
  return totals.reduce((best, score, seat) => (score > totals[best] ? seat : best), 0);
}

/** Places (1 = best) for each seat; equal totals share a place. */
export function places(totals: number[]): number[] {
  return totals.map((score) => 1 + totals.filter((other) => other > score).length);
}
