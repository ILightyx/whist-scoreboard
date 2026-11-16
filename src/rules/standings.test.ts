import { describe, expect, it } from 'vitest';
import { places, zeroWinsPlaces } from './standings';

describe('places', () => {
  it('ranks by total and shares places on ties', () => {
    expect(places([10, 30, 30, -5])).toEqual([3, 1, 1, 4]);
  });
});

describe('"0 points wins" places', () => {
  it('puts a player on 0 first, then the rest by total', () => {
    expect(zeroWinsPlaces([12, 0, 30, -4])).toEqual([3, 1, 2, 4]);
  });

  it('lets several players on 0 share first place', () => {
    expect(zeroWinsPlaces([0, 7, 0, 7])).toEqual([1, 3, 1, 3]);
  });

  it('falls back to the normal ranking when nobody is on 0', () => {
    expect(zeroWinsPlaces([5, 20, -3])).toEqual(places([5, 20, -3]));
  });
});
