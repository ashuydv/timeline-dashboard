import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import type { ChartData, MarkerGeom } from './chartGeometry';
import { downsampleForDisplay } from './downsample';
import { formatIst } from '../../utils/time';

const MARKER_ROW_Y_FRAC = 0.5; // markers drawn on a single row mid-band area (bands fill full height, markers overlay)
const BAND_HEIGHT_FRAC = 1;
const MIN_ZOOM_SPAN_MS = 60 * 1000; // 60s minimum zoom span
const PASS_COLOR = '#2e7d32';
const FAIL_COLOR = '#d32f2f';
const MARKER_RADIUS = 2.5;
const HOVER_RADIUS_PX = 8;

interface TimelineChartProps {
  data: ChartData;
  height?: number;
}

interface HoverInfo {
  x: number;
  y: number;
  marker: MarkerGeom;
}

export default function TimelineChart({ data, height = 340 }: TimelineChartProps) {
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

  const xScale = useCallback(
    (ms: number) => ((ms - domainStart) / (domainEnd - domainStart)) * width,
    [domainStart, domainEnd, width],
  );
  const xToMs = useCallback(
    (x: number) => domainStart + (x / width) * (domainEnd - domainStart),
    [domainStart, domainEnd, width],
  );

  // Downsample once per (data, domain, width) change — not per animation frame.
  const displayMarkers = useMemo(
    () => downsampleForDisplay(data.markers, domainStart, domainEnd, width),
    [data.markers, domainStart, domainEnd, width],
  );

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

    const bandTop = 0;
    const bandHeight = height * BAND_HEIGHT_FRAC;

    // Segment bands — resolved geometry, simple clipped rect fills.
    for (const seg of data.segments) {
      if (seg.endMs < domainStart || seg.startMs > domainEnd) continue;
      const x1 = xScale(Math.max(seg.startMs, domainStart));
      const x2 = xScale(Math.min(seg.endMs, domainEnd));
      const w = Math.max(x2 - x1, 0.5);
      ctx.fillStyle = seg.color;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x1, bandTop, w, bandHeight);
    }
    ctx.globalAlpha = 1;

    // Produce markers — pre-resolved x, no per-marker parsing/lookup in this loop.
    const markerY = height * MARKER_ROW_Y_FRAC;
    ctx.beginPath();
    ctx.fillStyle = PASS_COLOR;
    for (const m of displayMarkers) {
      if (m.result !== 'PASS') continue;
      const x = xScale(m.tsMs);
      ctx.moveTo(x + MARKER_RADIUS, markerY);
      ctx.arc(x, markerY, MARKER_RADIUS, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = FAIL_COLOR;
    for (const m of displayMarkers) {
      if (m.result !== 'FAIL') continue;
      const x = xScale(m.tsMs);
      ctx.moveTo(x + MARKER_RADIUS + 1, markerY);
      ctx.arc(x, markerY, MARKER_RADIUS + 1, 0, Math.PI * 2);
    }
    ctx.fill();

    // Drag-brush overlay
    if (dragStartX !== null && dragCurrentX !== null) {
      const x1 = Math.min(dragStartX, dragCurrentX);
      const x2 = Math.max(dragStartX, dragCurrentX);
      ctx.fillStyle = 'rgba(25, 118, 210, 0.2)';
      ctx.fillRect(x1, 0, x2 - x1, height);
      ctx.strokeStyle = 'rgba(25, 118, 210, 0.8)';
      ctx.strokeRect(x1, 0, x2 - x1, height);
    }
  }, [data.segments, displayMarkers, domainStart, domainEnd, width, height, xScale, dragStartX, dragCurrentX]);

  // Binary search nearest marker by x pixel for hover — O(log n), markers sorted by tsMs.
  const findNearestMarker = useCallback(
    (pxX: number): MarkerGeom | null => {
      if (displayMarkers.length === 0) return null;
      const targetMs = xToMs(pxX);
      let lo = 0;
      let hi = displayMarkers.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (displayMarkers[mid].tsMs < targetMs) lo = mid + 1;
        else hi = mid;
      }
      const candidates = [displayMarkers[lo - 1], displayMarkers[lo], displayMarkers[lo + 1]].filter(
        (m): m is MarkerGeom => !!m,
      );
      let best: MarkerGeom | null = null;
      let bestDist = Infinity;
      for (const c of candidates) {
        const d = Math.abs(xScale(c.tsMs) - pxX);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      return bestDist <= HOVER_RADIUS_PX ? best : null;
    },
    [displayMarkers, xToMs, xScale],
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
    const marker = findNearestMarker(x);
    if (marker) {
      setHover({ x, y: e.clientY - rect.top, marker });
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

  const handleDoubleClick = () => {
    setDomain([data.domainStartMs, data.domainEndMs]);
  };

  const axisTicks = useMemo(() => buildAxisTicks(domainStart, domainEnd, width), [domainStart, domainEnd, width]);

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">
        Shift + drag to zoom into a time range · double-click to reset
      </Typography>
      <Box ref={containerRef} sx={{ position: 'relative', mt: 1 }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
          style={{ display: 'block', cursor: dragStartX !== null ? 'col-resize' : 'crosshair' }}
        />
        {hover && (
          <Box
            sx={{
              position: 'absolute',
              left: Math.min(hover.x + 10, width - 160),
              top: Math.max(hover.y - 40, 0),
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
              {hover.marker.result}
            </div>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          {axisTicks.map((t) => (
            <Typography key={t.ms} variant="caption" color="text.secondary">
              {t.label}
            </Typography>
          ))}
        </Box>
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
