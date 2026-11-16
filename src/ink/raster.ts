// Turns pen strokes into the 28x28 image the digit model was trained on
// (MNIST style: the digit fits a 20x20 box, ink = 1, centred by mass).
// Pure TypeScript, no canvas, so it behaves the same in the browser and in tests.
// Keep in sync with centre_by_mass() in model/train_digits.py.

export interface Point {
  x: number;
  y: number;
}
export type Stroke = Point[];

export const IMAGE_SIZE = 28;
const BOX = 20;
/** Stroke width in model pixels, about MNIST's average pen width. */
const STROKE_WIDTH = 2.3;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function strokeBounds(strokes: Stroke[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (const point of stroke) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

function distanceToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSquared));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function draw(strokes: Stroke[], scale: number, offsetX: number, offsetY: number): Float32Array {
  const image = new Float32Array(IMAGE_SIZE * IMAGE_SIZE);
  const half = STROKE_WIDTH / 2;
  for (const stroke of strokes) {
    const points = stroke.map((p) => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY }));
    const segments = points.length === 1 ? [[points[0], points[0]]] : points.slice(1).map((p, i) => [points[i], p]);
    for (const [a, b] of segments) {
      const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - half - 1));
      const x1 = Math.min(IMAGE_SIZE - 1, Math.ceil(Math.max(a.x, b.x) + half + 1));
      const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - half - 1));
      const y1 = Math.min(IMAGE_SIZE - 1, Math.ceil(Math.max(a.y, b.y) + half + 1));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          // Pixel centres at +0.5; anti-aliased over one pixel at the edge.
          const coverage = Math.max(0, Math.min(1, half + 0.5 - distanceToSegment(x + 0.5, y + 0.5, a, b)));
          const index = y * IMAGE_SIZE + x;
          if (coverage > image[index]) image[index] = coverage;
        }
      }
    }
  }
  return image;
}

function centreOfMass(image: Float32Array): Point | null {
  let total = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < IMAGE_SIZE; y++) {
    for (let x = 0; x < IMAGE_SIZE; x++) {
      const value = image[y * IMAGE_SIZE + x];
      total += value;
      sx += value * x;
      sy += value * y;
    }
  }
  return total > 0 ? { x: sx / total, y: sy / total } : null;
}

/** 28x28 image (row-major, 0..1) of the strokes, ready for the recogniser. */
export function rasterize(strokes: Stroke[]): Float32Array {
  const bounds = strokeBounds(strokes);
  const width = Math.max(bounds.maxX - bounds.minX, 1e-3);
  const height = Math.max(bounds.maxY - bounds.minY, 1e-3);
  // Fit the longer side into the 20x20 box, keeping the aspect ratio. A thin "1"
  // stays thin instead of being stretched into a block.
  const scale = (BOX - STROKE_WIDTH) / Math.max(width, height);
  const offsetX = IMAGE_SIZE / 2 - (bounds.minX + width / 2) * scale;
  const offsetY = IMAGE_SIZE / 2 - (bounds.minY + height / 2) * scale;
  const first = draw(strokes, scale, offsetX, offsetY);
  const mass = centreOfMass(first);
  if (!mass) return first;
  // Same rounding as centre_by_mass() in train_digits.py (MNIST centres by mass).
  const shiftX = Math.round(IMAGE_SIZE / 2 - mass.x);
  const shiftY = Math.round(IMAGE_SIZE / 2 - mass.y);
  return draw(strokes, scale, offsetX + shiftX, offsetY + shiftY);
}

/**
 * Splits strokes into digits written side by side (for two-digit values such as
 * 10 diamonds). Strokes whose horizontal ranges overlap belong to one digit.
 */
export function splitDigits(strokes: Stroke[]): Stroke[][] {
  const items = strokes
    .map((stroke) => ({ stroke, bounds: strokeBounds([stroke]) }))
    .sort((a, b) => a.bounds.minX - b.bounds.minX);
  const groups: { strokes: Stroke[]; maxX: number; width: number }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    const tolerance = last ? Math.max(4, last.width * 0.15) : 0;
    if (last && item.bounds.minX <= last.maxX + tolerance) {
      last.strokes.push(item.stroke);
      last.maxX = Math.max(last.maxX, item.bounds.maxX);
      last.width = last.maxX - strokeBounds(last.strokes).minX;
    } else {
      groups.push({ strokes: [item.stroke], maxX: item.bounds.maxX, width: item.bounds.maxX - item.bounds.minX });
    }
  }
  return groups.map((group) => group.strokes);
}
