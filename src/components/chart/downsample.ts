import type { MarkerGeom } from './chartGeometry';

/**
 * Thin a single part-model's cumulative-count series to ~1 point per pixel
 * column for display, keeping every FAIL and at most one representative PASS
 * point per column. `points` must be sorted by tsMs (cumulativeCount is then
 * monotonically non-decreasing).
 *
 * Rationale: with 10-20k points spread across ~1200px of chart width, most
 * columns contain many PASS points whose line segments and markers would
 * render indistinguishably anyway — dropping the redundant ones changes
 * nothing visually but cuts draw calls by 10-20x. FAILs are rare and
 * load-bearing (an operator is looking for them), so every FAIL bypasses
 * the dedup and is always kept and always drawn as its own marker. The first
 * and last point of the series are also always kept so the polyline's
 * endpoints (and therefore its visible start/end value) never shift.
 */
export function downsampleForDisplay(
  points: MarkerGeom[],
  domainStartMs: number,
  domainEndMs: number,
  pixelWidth: number,
): MarkerGeom[] {
  if (points.length === 0 || pixelWidth <= 0) return [];

  const span = domainEndMs - domainStartMs;
  if (span <= 0) return points;

  const result: MarkerGeom[] = [];
  const seenPassColumn = new Set<number>();
  const colScale = pixelWidth / span;

  for (let i = 0; i < points.length; i++) {
    const m = points[i];
    const isEndpoint = i === 0 || i === points.length - 1;

    if (m.tsMs < domainStartMs || m.tsMs > domainEndMs) {
      // Still keep the last point before the domain and first point after it so a
      // partially-visible line segment draws correctly into/out of the viewport.
      continue;
    }

    if (m.result === 'FAIL' || isEndpoint) {
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

/** Which of the (already-downsampled) points should render a visible marker glyph vs. just feed the line. */
export function shouldRenderMarkerGlyph(pointCount: number): boolean {
  // Below this density, draw every point's PASS/FAIL glyph; above it, only FAILs get a
  // glyph (still every one of them) and PASS becomes pure line to avoid an unreadable
  // solid smear of circles.
  return pointCount <= 800;
}
