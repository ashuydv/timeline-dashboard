import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Paper, Chip, Button } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ZoomOutIcon from '@mui/icons-material/ZoomOutMap';
import type { ChartData, MarkerGeom } from './chartGeometry';
import { downsampleForDisplay, shouldRenderMarkerGlyph } from './downsample';
import { formatIst } from '../../utils/time';

const MIN_ZOOM_SPAN_MS = 60 * 1000; // 60s minimum zoom span
const FAIL_COLOR = '#d32f2f';
const MARKER_RADIUS = 2.5;
const HOVER_RADIUS_PX = 8;
const LEFT_AXIS_WIDTH = 56;
const BAND_LABEL_FONT = '600 11px system-ui, sans-serif';
const MIN_BAND_WIDTH_FOR_LABEL = 22;

interface TimelineChartProps {
  data: ChartData;
  height?: number;
}

interface HoverInfo {
  x: number;
  y: number;
  marker: MarkerGeom;
  color: string;
}

export default function TimelineChart({ data, height = 420 }: TimelineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(800);
  const [domain, setDomain] = useState<[number, number]>([data.domainStartMs, data.domainEndMs]);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragCurrentX, setDragCurrentX] = useState<number | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  // Reset the visible domain whenever fresh data arrives (new filter selection).
  useEffect(() => {
    setDomain([data.domainStartMs, data.domainEndMs]);
  }, [data.domainStartMs, data.domainEndMs]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [domainStart, domainEnd] = domain;
  const plotWidth = Math.max(width - LEFT_AXIS_WIDTH, 0);

  const xScale = useCallback(
    (ms: number) => LEFT_AXIS_WIDTH + ((ms - domainStart) / (domainEnd - domainStart)) * plotWidth,
    [domainStart, domainEnd, plotWidth],
  );
  const xToMs = useCallback(
    (x: number) => domainStart + ((x - LEFT_AXIS_WIDTH) / plotWidth) * (domainEnd - domainStart),
    [domainStart, domainEnd, plotWidth],
  );

  const maxY = Math.max(data.maxCumulativeCount, 1);
  const yScale = useCallback((count: number) => height - (count / maxY) * (height - 8) - 4, [height, maxY]);

  // Downsample once per (data, domain, width) change — not per animation frame.
  const displaySeries = useMemo(
    () =>
      data.series.map((s) => ({
        ...s,
        points: downsampleForDisplay(s.points, domainStart, domainEnd, plotWidth),
      })),
    [data.series, domainStart, domainEnd, plotWidth],
  );

  const totalDisplayedPoints = useMemo(
    () => displaySeries.reduce((sum, s) => sum + s.points.length, 0),
    [displaySeries],
  );
  const drawEveryGlyph = shouldRenderMarkerGlyph(totalDisplayedPoints);

  // Flat, time-sorted list across all series for hover hit-testing.
  const flatDisplayPoints = useMemo(() => {
    const all = displaySeries.flatMap((s) => s.points.map((p) => ({ point: p, color: s.color })));
    all.sort((a, b) => a.point.tsMs - b.point.tsMs);
    return all;
  }, [displaySeries]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Segment bands — resolved geometry, simple clipped rect fills.
    for (const seg of data.segments) {
      if (seg.endMs < domainStart || seg.startMs > domainEnd) continue;
      const x1 = xScale(Math.max(seg.startMs, domainStart));
      const x2 = xScale(Math.min(seg.endMs, domainEnd));
      const w = Math.max(x2 - x1, 0.5);
      ctx.fillStyle = seg.color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x1, 0, w, height);
      ctx.globalAlpha = 1;

      if (w >= MIN_BAND_WIDTH_FOR_LABEL) {
        ctx.save();
        ctx.font = BAND_LABEL_FONT;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cx = x1 + w / 2;
        const cy = height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(-Math.PI / 2);
        const label = seg.label.toUpperCase();
        // Only draw if the rotated text (now running vertically) fits within the band height.
        if (ctx.measureText(label).width <= height - 16) {
          ctx.fillText(label, 0, 0);
        }
        ctx.restore();
      }
    }

    // Y-axis gridlines + labels
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yTickCount = 4;
    for (let i = 0; i <= yTickCount; i++) {
      const val = Math.round((maxY * i) / yTickCount);
      const y = yScale(val);
      ctx.beginPath();
      ctx.moveTo(LEFT_AXIS_WIDTH, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillText(String(val), LEFT_AXIS_WIDTH - 8, y);
    }

    // Cumulative-production line + markers, per part model.
    for (const s of displaySeries) {
      if (s.points.length === 0) continue;

      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.75;
      s.points.forEach((p, i) => {
        const x = xScale(p.tsMs);
        const y = yScale(p.cumulativeCount);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // PASS glyphs (circles) — only at low density, to avoid an unreadable solid smear.
      if (drawEveryGlyph) {
        ctx.beginPath();
        ctx.fillStyle = s.color;
        for (const p of s.points) {
          if (p.result !== 'PASS') continue;
          const x = xScale(p.tsMs);
          const y = yScale(p.cumulativeCount);
          ctx.moveTo(x + MARKER_RADIUS, y);
          ctx.arc(x, y, MARKER_RADIUS, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // FAIL glyphs (crosses) — always drawn, every one, regardless of density.
      ctx.strokeStyle = FAIL_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const p of s.points) {
        if (p.result !== 'FAIL') continue;
        const x = xScale(p.tsMs);
        const y = yScale(p.cumulativeCount);
        const r = MARKER_RADIUS + 1.5;
        ctx.moveTo(x - r, y - r);
        ctx.lineTo(x + r, y + r);
        ctx.moveTo(x + r, y - r);
        ctx.lineTo(x - r, y + r);
      }
      ctx.stroke();
    }

    // Drag-brush overlay
    if (dragStartX !== null && dragCurrentX !== null) {
      const x1 = Math.min(dragStartX, dragCurrentX);
      const x2 = Math.max(dragStartX, dragCurrentX);
      ctx.fillStyle = 'rgba(25, 118, 210, 0.2)';
      ctx.fillRect(x1, 0, x2 - x1, height);
      ctx.strokeStyle = 'rgba(25, 118, 210, 0.8)';
      ctx.strokeRect(x1, 0, x2 - x1, height);
    }
  }, [
    data.segments,
    displaySeries,
    drawEveryGlyph,
    domainStart,
    domainEnd,
    width,
    height,
    maxY,
    xScale,
    yScale,
    dragStartX,
    dragCurrentX,
  ]);

  // Binary search nearest point by x pixel for hover — O(log n).
  const findNearestPoint = useCallback(
    (pxX: number): { point: MarkerGeom; color: string } | null => {
      if (flatDisplayPoints.length === 0) return null;
      const targetMs = xToMs(pxX);
      let lo = 0;
      let hi = flatDisplayPoints.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (flatDisplayPoints[mid].point.tsMs < targetMs) lo = mid + 1;
        else hi = mid;
      }
      const candidates = [flatDisplayPoints[lo - 1], flatDisplayPoints[lo], flatDisplayPoints[lo + 1]].filter(
        (c): c is { point: MarkerGeom; color: string } => !!c,
      );
      let best: { point: MarkerGeom; color: string } | null = null;
      let bestDist = Infinity;
      for (const c of candidates) {
        const d = Math.abs(xScale(c.point.tsMs) - pxX);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      return bestDist <= HOVER_RADIUS_PX ? best : null;
    },
    [flatDisplayPoints, xToMs, xScale],
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    setDragStartX(e.clientX - rect.left);
    setDragCurrentX(e.clientX - rect.left);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (dragStartX !== null) {
      setDragCurrentX(x);
      setHover(null);
      return;
    }
    const found = findNearestPoint(x);
    if (found) {
      setHover({ x: xScale(found.point.tsMs), y: yScale(found.point.cumulativeCount), marker: found.point, color: found.color });
    } else {
      setHover(null);
    }
  };

  const handleMouseUp = () => {
    if (dragStartX !== null && dragCurrentX !== null && Math.abs(dragCurrentX - dragStartX) > 4) {
      const msA = xToMs(dragStartX);
      const msB = xToMs(dragCurrentX);
      const newStart = Math.min(msA, msB);
      const newEnd = Math.max(msA, msB);
      if (newEnd - newStart >= MIN_ZOOM_SPAN_MS) {
        setDomain([newStart, newEnd]);
      }
    }
    setDragStartX(null);
    setDragCurrentX(null);
  };

  const handleMouseLeave = () => {
    setDragStartX(null);
    setDragCurrentX(null);
    setHover(null);
  };

  const resetZoom = useCallback(() => {
    setDomain([data.domainStartMs, data.domainEndMs]);
  }, [data.domainStartMs, data.domainEndMs]);

  const isZoomed = domainStart !== data.domainStartMs || domainEnd !== data.domainEndMs;

  const axisTicks = useMemo(
    () => buildAxisTicks(domainStart, domainEnd, plotWidth),
    [domainStart, domainEnd, plotWidth],
  );

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Shift + drag to zoom into a time range · double-click to reset · colored lines = cumulative
          production (OK + NG) per part model
        </Typography>
        {isZoomed && (
          <Button size="small" startIcon={<ZoomOutIcon fontSize="small" />} onClick={resetZoom} sx={{ flexShrink: 0 }}>
            Reset zoom
          </Button>
        )}
      </Box>
      <Box ref={containerRef} sx={{ position: 'relative', mt: 1 }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={resetZoom}
          style={{ display: 'block', cursor: dragStartX !== null ? 'col-resize' : 'crosshair' }}
        />
        {hover && (
          <Box
            sx={{
              position: 'absolute',
              left: Math.min(Math.max(hover.x + 10, LEFT_AXIS_WIDTH), width - 170),
              top: Math.max(hover.y - 44, 0),
              bgcolor: 'grey.900',
              color: 'common.white',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontSize: 12,
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}
          >
            <div>{formatIst(new Date(hover.marker.tsMs).toISOString(), 'dd MMM, HH:mm:ss')}</div>
            <div style={{ color: hover.marker.result === 'FAIL' ? '#ff8a80' : '#a5d6a7', fontWeight: 600 }}>
              {hover.marker.result} · cumulative {hover.marker.cumulativeCount}
            </div>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, pl: `${LEFT_AXIS_WIDTH}px` }}>
          {axisTicks.map((t) => (
            <Typography key={t.ms} variant="caption" color="text.secondary">
              {t.label}
            </Typography>
          ))}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
        {data.lastObserveTsMs !== null && (
          <Chip
            variant="outlined"
            color="primary"
            label={
              <>
                Last observed produce at:{' '}
                <strong>{formatIst(new Date(data.lastObserveTsMs).toISOString(), 'dd MMM, HH:mm:ss')}</strong>
              </>
            }
          />
        )}
        {data.unknownSegmentCount > 0 && (
          <Chip
            variant="outlined"
            color="warning"
            icon={<WarningAmberIcon />}
            label={`${data.unknownSegmentCount} unknown segments · ${data.unknownSegmentMinutes.toFixed(1)} min`}
          />
        )}
      </Box>
    </Paper>
  );
}

function buildAxisTicks(startMs: number, endMs: number, width: number): { ms: number; label: string }[] {
  const targetTicks = Math.max(2, Math.min(8, Math.floor(width / 120)));
  const span = endMs - startMs;
  const ticks: { ms: number; label: string }[] = [];
  for (let i = 0; i <= targetTicks; i++) {
    const ms = startMs + (span * i) / targetTicks;
    ticks.push({ ms, label: formatIst(new Date(ms).toISOString(), 'HH:mm') });
  }
  return ticks;
}
