import type { MarkerGeom } from './chartGeometry';

/**
 * Bucket markers into 1-per-pixel-column, keeping every FAIL and at most one
 * representative PASS per column. `markers` must be sorted by tsMs.
 *
 * Rationale: with 10-20k points spread across ~1200px of chart width, most
 * columns contain many PASS points that render as the same pixel anyway —
 * dropping the redundant ones changes nothing visually but cuts draw calls by
 * 10-20x. FAILs are rare and load-bearing (an operator is looking for them),
 * so every FAIL is kept regardless of how many share its column.
 */
export function downsampleForDisplay(
  markers: MarkerGeom[],
  domainStartMs: number,
  domainEndMs: number,
  pixelWidth: number,
): MarkerGeom[] {
  if (markers.length === 0 || pixelWidth <= 0) return [];

  const span = domainEndMs - domainStartMs;
  if (span <= 0) return markers;

  const result: MarkerGeom[] = [];
  const seenPassColumn = new Set<number>();
  const colScale = pixelWidth / span;

  for (const m of markers) {
    if (m.tsMs < domainStartMs || m.tsMs > domainEndMs) continue;

    if (m.result === 'FAIL') {
      result.push(m);
      continue;
    }

    const col = Math.floor((m.tsMs - domainStartMs) * colScale);
    if (!seenPassColumn.has(col)) {
      seenPassColumn.add(col);
      result.push(m);
    }
  }

  result.sort((a, b) => a.tsMs - b.tsMs);
  return result;
}
