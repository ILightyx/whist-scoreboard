/** Seat with the highest total; the first such seat on ties (CardGameRules.get_game_winner). */
export function leaderSeat(totals: number[]): number {
  return totals.reduce((best, score, seat) => (score > totals[best] ? seat : best), 0);
}

/** Places (1 = best) for each seat; equal totals share a place. */
export function places(totals: number[]): number[] {
  return totals.map((score) => 1 + totals.filter((other) => other > score).length);
}

/**
 * Final places with the "0 points wins" house rule (a Whist setup option, not
 * part of the game's own rules): everyone who ends on exactly 0 shares first
 * place and the others follow by total. If nobody is on 0, places are normal.
 */
export function zeroWinsPlaces(totals: number[]): number[] {
  const zeros = totals.filter((score) => score === 0).length;
  if (zeros === 0) return places(totals);
  return totals.map((score) => (score === 0 ? 1 : 1 + zeros + totals.filter((other) => other !== 0 && other > score).length));
}
