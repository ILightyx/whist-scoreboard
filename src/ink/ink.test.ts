import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isScratchOut, isTap } from './gestures';
import { IMAGE_SIZE, rasterize, splitDigits, type Stroke } from './raster';
import { parseModel, recognize } from './recognizer';

const model = parseModel(JSON.parse(readFileSync(new URL('../../public/models/digits.json', import.meta.url), 'utf8')));

/** Points along straight segments between the given corners (like a pen sampling at ~2px). */
function path(...corners: [number, number][]): Stroke {
  const points: Stroke = [];
  for (let i = 1; i < corners.length; i++) {
    const [x0, y0] = corners[i - 1];
    const [x1, y1] = corners[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
    for (let s = 0; s < steps; s++) points.push({ x: x0 + ((x1 - x0) * s) / steps, y: y0 + ((y1 - y0) * s) / steps });
  }
  points.push({ x: corners[corners.length - 1][0], y: corners[corners.length - 1][1] });
  return points;
}

function ellipse(cx: number, cy: number, rx: number, ry: number, from = 0, to = Math.PI * 2): Stroke {
  const points: Stroke = [];
  for (let a = from; a <= to + 1e-9; a += 0.08) points.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  return points;
}

// Digits written the way a pen would, in a ~60x90 px cell.
const DIGITS: Record<number, Stroke[]> = {
  0: [ellipse(30, 45, 20, 38)],
  1: [path([24, 18], [34, 6], [34, 88])],
  2: [[...ellipse(30, 28, 20, 20, Math.PI * 1.05, Math.PI * 2.25), ...path([42, 44], [10, 86], [52, 86])]],
  3: [[...ellipse(28, 26, 18, 18, Math.PI * 1.15, Math.PI * 2.5), ...ellipse(28, 64, 20, 20, Math.PI * 1.5, Math.PI * 2.85)]],
  4: [path([38, 6], [8, 60], [56, 60]), path([42, 30], [42, 92])],
  7: [path([8, 10], [54, 10], [24, 90])],
  8: [[...ellipse(30, 26, 16, 18, Math.PI * 0.5, Math.PI * 2.5), ...ellipse(30, 66, 20, 22, -Math.PI * 0.5, Math.PI * 1.5)]],
};

describe('rasterize', () => {
  it('centres the digit by mass in a 28x28 image', () => {
    const image = rasterize(DIGITS[0]);
    expect(image).toHaveLength(IMAGE_SIZE * IMAGE_SIZE);
    let total = 0;
    let cx = 0;
    let cy = 0;
    image.forEach((value, index) => {
      total += value;
      cx += value * (index % IMAGE_SIZE);
      cy += value * Math.floor(index / IMAGE_SIZE);
    });
    expect(Math.abs(cx / total - 14)).toBeLessThan(1);
    expect(Math.abs(cy / total - 14)).toBeLessThan(1);
  });

  it('gives the same image wherever and however large the digit is written', () => {
    const shifted = DIGITS[7].map((stroke) => stroke.map((p) => ({ x: p.x * 2 + 300, y: p.y * 2 + 40 })));
    const a = rasterize(DIGITS[7]);
    const b = rasterize(shifted);
    const difference = a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0);
    expect(difference / a.length).toBeLessThan(0.02);
  });
});

describe('recognize', () => {
  it.each(Object.entries(DIGITS))('reads a pen-written %s', (digit, strokes) => {
    const [best] = recognize(model, strokes, 9);
    expect(best.value).toBe(Number(digit));
  });

  it('only offers values the cell allows', () => {
    const results = recognize(model, DIGITS[7], 3);
    expect(results.every((candidate) => candidate.value <= 3)).toBe(true);
    expect(recognize(model, DIGITS[1], 8, 1).some((candidate) => candidate.value === 1)).toBe(false);
  });

  it('reads two digits side by side when the cell allows 10 or more', () => {
    const ten = [DIGITS[1][0], ...DIGITS[0].map((stroke) => stroke.map((p) => ({ x: p.x + 70, y: p.y })))];
    expect(splitDigits(ten)).toHaveLength(2);
    expect(recognize(model, ten, 12)[0].value).toBe(10);
  });

  it('keeps the strokes of one digit together', () => {
    expect(splitDigits(DIGITS[4])).toHaveLength(1);
  });
});

describe('gestures', () => {
  it('tells a tap from writing', () => {
    expect(isTap([{ x: 10, y: 10 }, { x: 11, y: 12 }])).toBe(true);
    expect(isTap(DIGITS[1][0])).toBe(false);
  });

  it('recognises a scratch-out but not a digit', () => {
    const scratch = path([5, 40], [55, 44], [6, 48], [54, 52], [5, 56], [56, 60]);
    expect(isScratchOut(scratch)).toBe(true);
    expect(isScratchOut(DIGITS[7][0])).toBe(false);
    expect(isScratchOut(DIGITS[0][0])).toBe(false);
  });
});
