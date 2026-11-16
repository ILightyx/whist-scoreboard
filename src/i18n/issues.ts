import type { SheetIssue } from '../game/model';
import type { Translate } from './translate';

/** One sentence explaining why a round can't be scored yet. */
export function describeIssue(t: Translate, issue: SheetIssue, players: readonly string[]): string {
  switch (issue.kind) {
    case 'banned-bet':
      return t('issue.bannedBet', { name: players[issue.seat], bet: issue.bet });
    case 'tricks-total':
      return t('issue.tricksTotal', { actual: issue.actual, expected: issue.expected });
    case 'bet-too-high':
      return t('issue.betTooHigh', { name: players[issue.seat], max: issue.max });
    case 'tricks-too-high':
      return t('issue.tricksTooHigh', { name: players[issue.seat], max: issue.max });
    case 'rentz-total':
      return t(`issue.total.${issue.field}`, { actual: issue.actual, expected: issue.expected });
    case 'king-of-hearts':
      return t('issue.kingOfHearts', { count: issue.count });
    case 'places-duplicate':
      return t('issue.placesDuplicate');
    case 'places-range':
      return t('issue.placesRange', { max: issue.max });
  }
}
