import { strokeBounds, type Stroke } from './raster';

/**
 * A touch that barely moves opens the number pad instead of writing. It is
 * decided by movement only: even a small "0" is far bigger than 6 px, and a slow,
 * deliberate pen tap must not turn into a dot that gets read as a digit.
 */
export function isTap(stroke: Stroke): boolean {
  if (stroke.length === 0) return false;
  const bounds = strokeBounds([stroke]);
  return bounds.maxX - bounds.minX < 6 && bounds.maxY - bounds.minY < 6;
}

/**
 * A scratch-out: a wide zig-zag with several left/right reversals, drawn
 * over a cell to clear it (like crossing out on paper).
 */
export function isScratchOut(stroke: Stroke): boolean {
  if (stroke.length < 5) return false;
  const bounds = strokeBounds([stroke]);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width < 18) return false;
  let reversals = 0;
  let direction = 0;
  let anchor = stroke[0].x;
  for (const point of stroke) {
    const dx = point.x - anchor;
    if (Math.abs(dx) < width * 0.25) continue;
    const next = Math.sign(dx);
    if (direction !== 0 && next !== direction) reversals++;
    direction = next;
    anchor = point.x;
  }
  return reversals >= 3 && width > height * 0.8;
}
