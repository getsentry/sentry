import {useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {getFormattedDate} from 'sentry/utils/dates';
import type {DurationHeatmapData} from 'sentry/views/insights/awsLambda/mockData';

function useElementWidth<T extends HTMLElement>(initial = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    if (!ref.current) {
      return;
    }
    const observer = new ResizeObserver(entries =>
      setWidth(Math.max(120, Math.round(entries[0]!.contentRect.width)))
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Trend line in the de-emphasis colour; only the latest value carries the accent. */
export function Sparkline({
  values,
  variant = 'accent',
  width = 120,
  height = 28,
  fluid = false,
}: {
  values: Array<number | null>;
  fluid?: boolean;
  height?: number;
  variant?: 'accent' | 'danger' | 'warning' | 'muted';
  width?: number;
}) {
  const theme = useTheme();
  const [ref, measured] = useElementWidth<HTMLDivElement>(width);
  const w = fluid ? measured : width;
  const present = values.map(v => v ?? 0);
  const max = Math.max(...present, 1e-9);
  const min = Math.min(...present, 0);
  const pad = 3;
  const step = present.length > 1 ? (w - pad * 2) / (present.length - 1) : 0;
  const xy = present.map(
    (v, i) =>
      [
        pad + i * step,
        height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2),
      ] as const
  );
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = xy[xy.length - 1];
  const accent =
    variant === 'danger'
      ? theme.tokens.graphics.danger.vibrant
      : variant === 'warning'
        ? theme.tokens.graphics.warning.vibrant
        : variant === 'muted'
          ? theme.tokens.graphics.neutral.vibrant
          : theme.tokens.graphics.accent.vibrant;
  const trend = theme.tokens.graphics.neutral.vibrant;
  return (
    <div ref={ref} style={{width: fluid ? '100%' : width, height}}>
      <svg width={w} height={height} aria-hidden>
        <polygon
          points={`${pad},${height} ${line} ${w - pad},${height}`}
          fill={trend}
          opacity={0.1}
        />
        <polyline
          points={line}
          fill="none"
          stroke={trend}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {last && (
          <circle
            cx={last[0]}
            cy={last[1]}
            r={3}
            fill={accent}
            stroke={theme.tokens.background.primary}
            strokeWidth={1.5}
          />
        )}
      </svg>
    </div>
  );
}

export interface HeatmapSelection {
  maxDuration: number;
  maxTime: number;
  minDuration: number;
  minTime: number;
}

function formatDuration(ms: number) {
  if (ms >= 60_000) {
    return `${+(ms / 60_000).toFixed(1)}min`;
  }
  if (ms >= 1000) {
    return `${+(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s`;
  }
  return `${+ms.toPrecision(2)}ms`;
}

/** 1-2-5 values inside the range, thinned to fit the available height. */
function logTicks(min: number, max: number, maxTicks: number) {
  const ticks: number[] = [];
  for (let exp = Math.floor(Math.log10(min)); exp <= Math.ceil(Math.log10(max)); exp++) {
    for (const d of [1, 2, 5]) {
      const v = d * 10 ** exp;
      if (v >= min && v <= max) {
        ticks.push(v);
      }
    }
  }
  return ticks.length > maxTicks
    ? ticks.filter(v => Math.log10(v) % 1 === 0 || Math.abs(Math.log10(v / 5) % 1) < 1e-9)
    : ticks;
}

function percentileOf(counts: number[], edges: number[], p: number) {
  const total = counts.reduce((sum, c) => sum + c, 0);
  let acc = 0;
  for (let i = 0; i < counts.length; i++) {
    acc += counts[i]!;
    if (acc >= total * p) {
      return edges[i + 1]!;
    }
  }
  return edges[edges.length - 1]!;
}

/**
 * Latency heatmap of every invocation: time × log(duration), shade = invocations per cell.
 * Cells are contiguous; the shade blends a square-root and a rank scale so both the main
 * mode and a thin slow tail stay visible. Drag to select a region and compare it with the rest.
 */
export function LatencyHeatmap({
  data,
  timeoutMs,
  releases = [],
  selection,
  onSelect,
  height = 260,
}: {
  data: DurationHeatmapData;
  onSelect: (selection: HeatmapSelection | null) => void;
  selection: HeatmapSelection | null;
  timeoutMs: number;
  height?: number;
  releases?: Array<{label: string; timestamp: number}>;
}) {
  const theme = useTheme();
  const [ref, width] = useElementWidth<HTMLDivElement>(900);
  const [hover, setHover] = useState<{col: number; row: number} | null>(null);
  const [drag, setDrag] = useState<{
    col0: number;
    col1: number;
    row0: number;
    row1: number;
  } | null>(null);

  const {counts, edges, starts, interval} = data;
  const columns = starts.length;
  const rows = edges.length - 1;
  const margin = {left: 52, right: 8, top: 20, bottom: 24};
  const plotW = Math.max(10, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;
  const cw = plotW / columns;
  const ch = plotH / rows;
  const logMin = Math.log10(edges[0]!);
  const logMax = Math.log10(edges[rows]!);
  const yOf = (ms: number) =>
    margin.top + plotH - ((Math.log10(ms) - logMin) / (logMax - logMin)) * plotH;
  const xOf = (ts: number) =>
    margin.left + ((ts - starts[0]!) / (interval * columns)) * plotW;

  // Hybrid colour scale (see Datadog's heatmap write-up): half sqrt, half rank.
  const shade = useMemo(() => {
    const nonZero = counts
      .flat()
      .filter(c => c > 0)
      .sort((a, b) => a - b);
    // Clip at the 99th percentile cell so one outlier doesn't wash out everything else.
    const max = nonZero[Math.floor((nonZero.length - 1) * 0.99)] ?? 1;
    return (count: number) => {
      if (count <= 0) {
        return 0;
      }
      let lo = 0;
      let hi = nonZero.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (nonZero[mid]! < count) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      const rank = nonZero.length > 1 ? lo / (nonZero.length - 1) : 1;
      return Math.min(1, 0.6 * Math.sqrt(count / max) + 0.4 * rank);
    };
  }, [counts]);

  const cellAt = (event: React.MouseEvent) => {
    const box = event.currentTarget.getBoundingClientRect();
    const col = Math.floor((event.clientX - box.left - margin.left) / cw);
    const row = rows - 1 - Math.floor((event.clientY - box.top - margin.top) / ch);
    return {
      col: Math.min(columns - 1, Math.max(0, col)),
      row: Math.min(rows - 1, Math.max(0, row)),
    };
  };

  const toSelection = (r: {
    col0: number;
    col1: number;
    row0: number;
    row1: number;
  }): HeatmapSelection => ({
    minTime: starts[Math.min(r.col0, r.col1)]!,
    maxTime: starts[Math.max(r.col0, r.col1)]! + interval,
    minDuration: edges[Math.min(r.row0, r.row1)]!,
    maxDuration: edges[Math.max(r.row0, r.row1) + 1]!,
  });

  const shown = drag ? toSelection(drag) : selection;
  const selRect = shown
    ? {
        x: Math.max(margin.left, xOf(shown.minTime)),
        x2: Math.min(margin.left + plotW, xOf(shown.maxTime)),
        y: Math.max(margin.top, yOf(Math.min(shown.maxDuration, edges[rows]!))),
        y2: Math.min(margin.top + plotH, yOf(Math.max(shown.minDuration, edges[0]!))),
      }
    : null;

  const yTicks = logTicks(edges[0]!, edges[rows]!, Math.floor(plotH / 22));
  const xTickEvery = Math.max(
    1,
    Math.ceil(columns / Math.max(2, Math.floor(plotW / 110)))
  );
  const span = interval * columns;
  const timeFormat =
    span > 3 * 86_400_000 ? 'MMM D' : span > 26 * 3_600_000 ? 'MMM D HH:mm' : 'HH:mm';
  const accent = theme.tokens.graphics.accent.vibrant;
  const surface = theme.tokens.background.primary;
  const highlight = theme.tokens.graphics.warning.vibrant;
  const hoverColumn = hover ? counts[hover.col]! : null;

  return (
    <Stack gap="sm">
      <HeatmapFrame ref={ref}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Invocation duration heatmap"
          onMouseMove={event => {
            const cell = cellAt(event);
            setHover(cell);
            if (drag) {
              setDrag({...drag, col1: cell.col, row1: cell.row});
            }
          }}
          onMouseLeave={() => {
            setHover(null);
            if (drag) {
              onSelect(toSelection(drag));
              setDrag(null);
            }
          }}
          onMouseDown={event => {
            const cell = cellAt(event);
            setDrag({col0: cell.col, col1: cell.col, row0: cell.row, row1: cell.row});
          }}
          onMouseUp={() => {
            if (drag) {
              onSelect(toSelection(drag));
              setDrag(null);
            }
          }}
        >
          {counts.map((column, x) =>
            column.map((count, y) => {
              const v = shade(count);
              return v > 0 ? (
                <rect
                  key={`${x}-${y}`}
                  x={margin.left + x * cw}
                  y={margin.top + plotH - (y + 1) * ch}
                  width={cw + 0.5}
                  height={ch + 0.5}
                  shapeRendering="crispEdges"
                  style={{
                    fill: `color-mix(in oklab, ${accent} ${Math.round(8 + 92 * v)}%, ${surface})`,
                  }}
                />
              ) : null;
            })
          )}

          {/* Everything outside the selection fades, like Honeycomb's BubbleUp. */}
          {selRect && (
            <g pointerEvents="none">
              <path
                d={`M${margin.left},${margin.top}h${plotW}v${plotH}h${-plotW}z M${selRect.x},${selRect.y}V${selRect.y2}H${selRect.x2}V${selRect.y}z`}
                fill={theme.tokens.background.primary}
                fillOpacity={0.6}
                fillRule="evenodd"
              />
              <rect
                x={selRect.x}
                y={selRect.y}
                width={selRect.x2 - selRect.x}
                height={selRect.y2 - selRect.y}
                fill="none"
                stroke={highlight}
                strokeWidth={2}
              />
            </g>
          )}

          {releases.map(release => {
            const x = xOf(release.timestamp);
            return x >= margin.left && x <= margin.left + plotW ? (
              <g key={release.label} pointerEvents="none">
                <line
                  x1={x}
                  x2={x}
                  y1={margin.top - 4}
                  y2={margin.top + plotH}
                  stroke={theme.tokens.content.secondary}
                  strokeWidth={1}
                />
                <text
                  x={x + 4}
                  y={margin.top - 7}
                  fontSize={10}
                  fill={theme.tokens.content.secondary}
                >
                  {release.label}
                </text>
              </g>
            ) : null;
          })}

          {timeoutMs <= edges[rows]! && (
            <g pointerEvents="none">
              <line
                x1={margin.left}
                x2={margin.left + plotW}
                y1={yOf(timeoutMs)}
                y2={yOf(timeoutMs)}
                stroke={theme.tokens.graphics.danger.vibrant}
                strokeDasharray="4 3"
              />
              <text
                x={margin.left + plotW - 4}
                y={yOf(timeoutMs) - 4}
                fontSize={10}
                textAnchor="end"
                fill={theme.tokens.content.secondary}
              >
                {`timeout ${formatDuration(timeoutMs)}`}
              </text>
            </g>
          )}

          {hover && !drag && (
            <rect
              pointerEvents="none"
              x={margin.left + hover.col * cw}
              y={margin.top + plotH - (hover.row + 1) * ch}
              width={cw}
              height={ch}
              fill="none"
              stroke={theme.tokens.content.primary}
              strokeWidth={1.5}
            />
          )}

          <line
            x1={margin.left}
            x2={margin.left + plotW}
            y1={margin.top + plotH}
            y2={margin.top + plotH}
            stroke={theme.tokens.border.primary}
          />
          {yTicks.map(v => (
            <g key={v}>
              <line
                x1={margin.left - 4}
                x2={margin.left}
                y1={yOf(v)}
                y2={yOf(v)}
                stroke={theme.tokens.border.primary}
              />
              <text
                x={margin.left - 8}
                y={yOf(v) + 3}
                fontSize={10}
                textAnchor="end"
                fill={theme.tokens.content.secondary}
              >
                {formatDuration(v)}
              </text>
            </g>
          ))}
          {starts.map((start, i) =>
            i % xTickEvery === 0 ? (
              <text
                key={start}
                x={margin.left + i * cw}
                y={height - 6}
                fontSize={10}
                fill={theme.tokens.content.secondary}
              >
                {getFormattedDate(start, timeFormat)}
              </text>
            ) : null
          )}
        </svg>

        {hover && hoverColumn && !drag && (
          <HeatmapTooltip
            style={{
              left: Math.min(width - 230, margin.left + (hover.col + 1) * cw + 12),
              top: Math.max(0, margin.top + plotH - (hover.row + 1) * ch - 30),
            }}
          >
            <Text size="xs" variant="muted">
              {`${getFormattedDate(starts[hover.col], 'MMM D HH:mm')} – ${getFormattedDate(starts[hover.col]! + interval, 'HH:mm')}`}
            </Text>
            <Text size="sm" bold tabular>
              {`${Math.round(hoverColumn[hover.row]!).toLocaleString()} invocations`}
            </Text>
            <Text size="xs" tabular>
              {`took ${formatDuration(edges[hover.row]!)} – ${formatDuration(edges[hover.row + 1]!)}`}
            </Text>
            <Text size="xs" variant="muted" tabular>
              {`interval p50 ${formatDuration(Math.min(timeoutMs, percentileOf(hoverColumn, edges, 0.5)))} · p95 ${formatDuration(Math.min(timeoutMs, percentileOf(hoverColumn, edges, 0.95)))}`}
            </Text>
          </HeatmapTooltip>
        )}
      </HeatmapFrame>
      <Flex justify="between" align="center" gap="md" wrap="wrap" paddingLeft="2xl">
        <Flex align="center" gap="sm">
          <Text size="xs" variant="muted">
            {'fewer'}
          </Text>
          <ScaleBar />
          <Text size="xs" variant="muted">
            {'more invocations'}
          </Text>
        </Flex>
        <Text size="xs" variant="muted">
          {'Drag across the chart to compare a region with everything else'}
        </Text>
      </Flex>
    </Stack>
  );
}

const HeatmapFrame = styled('div')`
  position: relative;
  user-select: none;
  cursor: crosshair;
`;

const HeatmapTooltip = styled('div')`
  position: absolute;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 200px;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary};
  box-shadow: ${p => p.theme.shadow.high};
`;

const ScaleBar = styled('span')`
  display: inline-block;
  width: 96px;
  height: 8px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    color-mix(
      in oklab,
      ${p => p.theme.tokens.graphics.accent.vibrant} 8%,
      ${p => p.theme.tokens.background.primary}
    ),
    ${p => p.theme.tokens.graphics.accent.vibrant}
  );
`;

/**
 * Distribution as columns: thin bars with rounded tops, a 2px gap, and reference lines whose
 * labels sit in their own lane above the plot so they never cover bars or each other.
 */
export function Histogram({
  bins,
  markers = [],
  formatX,
  unit = 'invocations',
  height = 180,
  maxY,
  formatY = value => Math.round(value).toLocaleString(),
}: {
  bins: Array<{count: number; from: number; to: number; highlight?: boolean}>;
  formatX: (value: number) => string;
  formatY?: (value: number) => string;
  height?: number;
  markers?: Array<{
    label: string;
    value: number;
    variant: 'danger' | 'warning' | 'accent';
  }>;
  /** Shared y-scale, so histograms placed together compare by height. */
  maxY?: number;
  unit?: string;
}) {
  const theme = useTheme();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const margin = {
    left: 40,
    right: 8,
    top: 18 + 14 * Math.max(0, markers.length - 1),
    bottom: 22,
  };
  const plotW = Math.max(10, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;
  const max = maxY ?? Math.max(1, ...bins.map(b => b.count));
  const min = bins[0]?.from ?? 0;
  const maxX = bins[bins.length - 1]?.to ?? 1;
  const slot = plotW / Math.max(1, bins.length);
  const barW = Math.max(2, Math.min(24, slot - 2));
  const xOf = (v: number) => margin.left + ((v - min) / (maxX - min || 1)) * plotW;
  const yOf = (count: number) => margin.top + plotH - (count / max) * plotH;
  const tickStep =
    [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find(
      step => max / step <= 4
    ) ?? max;
  const gridValues = Array.from(
    {length: Math.floor(max / tickStep) + 1},
    (_, i) => i * tickStep
  );
  const sortedMarkers = markers.slice().sort((a, b) => a.value - b.value);

  return (
    <div ref={ref} style={{position: 'relative'}}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Histogram"
        onMouseLeave={() => setHover(null)}
      >
        {gridValues.map(v => (
          <g key={v}>
            <line
              x1={margin.left}
              x2={margin.left + plotW}
              y1={yOf(v)}
              y2={yOf(v)}
              stroke={theme.tokens.border.secondary}
            />
            <text
              x={margin.left - 6}
              y={yOf(v) + 3}
              fontSize={10}
              textAnchor="end"
              fill={theme.tokens.content.secondary}
            >
              {formatY(v)}
            </text>
          </g>
        ))}
        {bins.map((bin, i) => {
          const h = (bin.count / max) * plotH;
          const x = margin.left + i * slot + (slot - barW) / 2;
          const y = margin.top + plotH - h;
          const r = Math.min(4, barW / 2, h);
          const color = bin.highlight
            ? theme.tokens.graphics.warning.vibrant
            : theme.tokens.graphics.accent.vibrant;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect
                x={margin.left + i * slot}
                y={margin.top}
                width={slot}
                height={plotH}
                fill="transparent"
              />
              {h > 0 && (
                <path
                  d={`M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + barW - r}Q${x + barW},${y} ${x + barW},${y + r}V${y + h}Z`}
                  fill={color}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
            </g>
          );
        })}
        {sortedMarkers.map((marker, i) => {
          const x = xOf(marker.value);
          const labelY = 11 + 14 * i;
          const anchorEnd = x > margin.left + plotW - 120;
          return (
            <g key={marker.label} pointerEvents="none">
              <line
                x1={x}
                x2={x}
                y1={labelY + 3}
                y2={margin.top + plotH}
                stroke={theme.tokens.graphics[marker.variant].vibrant}
                strokeDasharray="4 3"
              />
              <text
                x={anchorEnd ? x - 4 : x + 4}
                y={labelY}
                fontSize={10}
                fill={theme.tokens.content.secondary}
                textAnchor={anchorEnd ? 'end' : 'start'}
              >
                {marker.label}
              </text>
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <text
            key={f}
            x={margin.left + f * plotW}
            y={height - 6}
            fontSize={10}
            fill={theme.tokens.content.secondary}
            textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}
          >
            {formatX(min + f * (maxX - min))}
          </text>
        ))}
      </svg>
      {hover !== null && bins[hover] && (
        <HeatmapTooltip
          style={{
            left: Math.min(width - 210, margin.left + (hover + 1) * slot + 8),
            top: margin.top,
          }}
        >
          <Text size="sm" bold tabular>
            {`${formatY(bins[hover].count)} ${unit}`}
          </Text>
          <Text size="xs" variant="muted" tabular>
            {`${formatX(bins[hover].from)} – ${formatX(bins[hover].to)}`}
          </Text>
        </HeatmapTooltip>
      )}
    </div>
  );
}

export interface MapNode {
  column: 0 | 1 | 2;
  id: string;
  label: string;
  sublabel?: string;
  variant?: 'critical' | 'warning' | 'healthy' | 'neutral';
}

export interface MapEdge {
  from: string;
  to: string;
  label?: string;
  variant?: 'danger' | 'neutral';
  weight?: number;
}

/** Three-column dependency map: event sources → functions → downstream resources. */
export function ServiceMap({
  nodes,
  edges,
  onNodeClick,
  highlighted,
}: {
  edges: MapEdge[];
  nodes: MapNode[];
  highlighted?: string | null;
  onNodeClick?: (id: string) => void;
}) {
  const theme = useTheme();
  const [ref, width] = useElementWidth<HTMLDivElement>(1000);
  const [hover, setHover] = useState<string | null>(null);
  const rowHeight = 46;
  const columns = [0, 1, 2].map(c => nodes.filter(n => n.column === c));
  const height = Math.max(...columns.map(c => c.length)) * rowHeight + 40;
  const nodeWidth = Math.min(240, (width - 40) / 3.6);
  const maxChars = Math.floor((nodeWidth - 34) / 7);
  const xs = [10, (width - nodeWidth) / 2, width - nodeWidth - 10];
  const pos = new Map<string, {x: number; y: number}>();
  columns.forEach((column, c) => {
    const offset = (height - column.length * rowHeight) / 2;
    column.forEach((node, i) =>
      pos.set(node.id, {x: xs[c]!, y: offset + i * rowHeight + 6})
    );
  });
  const focus = hover ?? highlighted ?? null;
  const connected = (edge: MapEdge) => !focus || edge.from === focus || edge.to === focus;
  const nodeColor = (variant: MapNode['variant']) =>
    variant === 'critical'
      ? theme.tokens.graphics.danger.vibrant
      : variant === 'warning'
        ? theme.tokens.graphics.warning.vibrant
        : variant === 'healthy'
          ? theme.tokens.graphics.success.vibrant
          : theme.tokens.graphics.neutral.moderate;

  return (
    <div ref={ref}>
      <svg width={width} height={height} role="img" aria-label="Service map">
        {edges.map(edge => {
          const a = pos.get(edge.from);
          const b = pos.get(edge.to);
          if (!a || !b) {
            return null;
          }
          const x1 = a.x + nodeWidth;
          const y1 = a.y + 17;
          const x2 = b.x;
          const y2 = b.y + 17;
          const mid = (x1 + x2) / 2;
          return (
            <g key={`${edge.from}-${edge.to}`} opacity={connected(edge) ? 1 : 0.15}>
              <path
                d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                fill="none"
                stroke={
                  edge.variant === 'danger'
                    ? theme.tokens.graphics.danger.vibrant
                    : theme.tokens.graphics.neutral.moderate
                }
                strokeWidth={Math.max(1, Math.min(6, edge.weight ?? 1.5))}
                opacity={0.7}
              />
              {edge.label && focus && (
                <text
                  x={mid}
                  y={(y1 + y2) / 2 - 4}
                  fontSize={10}
                  textAnchor="middle"
                  fill={theme.tokens.content.secondary}
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map(node => {
          const p = pos.get(node.id)!;
          const active =
            !focus ||
            focus === node.id ||
            edges.some(
              e =>
                (e.from === focus && e.to === node.id) ||
                (e.to === focus && e.from === node.id)
            );
          return (
            <g
              key={node.id}
              transform={`translate(${p.x},${p.y})`}
              opacity={active ? 1 : 0.35}
              onMouseEnter={() => setHover(node.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onNodeClick?.(node.id)}
              style={{cursor: onNodeClick ? 'pointer' : 'default'}}
            >
              <rect
                width={nodeWidth}
                height={34}
                rx={6}
                fill={theme.tokens.background.primary}
                stroke={
                  focus === node.id
                    ? theme.tokens.graphics.accent.vibrant
                    : theme.tokens.border.primary
                }
                strokeWidth={focus === node.id ? 2 : 1}
              />
              <circle cx={14} cy={17} r={5} fill={nodeColor(node.variant)} />
              <text
                x={26}
                y={node.sublabel ? 14 : 21}
                fontSize={12}
                fontWeight={600}
                fill={theme.tokens.content.primary}
              >
                {node.label.length > maxChars
                  ? `${node.label.slice(0, maxChars - 1)}…`
                  : node.label}
              </text>
              {node.sublabel && (
                <text x={26} y={27} fontSize={10} fill={theme.tokens.content.secondary}>
                  {node.sublabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Horizontal paired bars: selection vs baseline share for each attribute value. */
export function ComparisonBars({
  rows,
  onFilter,
}: {
  rows: Array<{baseline: number; selection: number; value: string}>;
  onFilter?: (value: string) => void;
}) {
  return (
    <Stack gap="xs">
      {rows.map(row => (
        <Tooltip
          key={row.value}
          title={onFilter ? `Filter to ${row.value}` : undefined}
          skipWrapper
        >
          <ComparisonRow onClick={() => onFilter?.(row.value)} clickable={!!onFilter}>
            <Text size="xs" monospace ellipsis>
              {row.value}
            </Text>
            <Stack gap="0">
              <Bar
                variant="selection"
                style={{width: `${Math.max(1, row.selection * 100)}%`}}
              />
              <Bar
                variant="baseline"
                style={{width: `${Math.max(1, row.baseline * 100)}%`}}
              />
            </Stack>
            <Flex gap="xs" justify="end">
              <Text size="xs" tabular>
                {Math.round(row.selection * 100)}%
              </Text>
              <Text size="xs" tabular variant="muted">
                vs {Math.round(row.baseline * 100)}%
              </Text>
            </Flex>
          </ComparisonRow>
        </Tooltip>
      ))}
    </Stack>
  );
}

const ComparisonRow = styled('div')<{clickable: boolean}>`
  display: grid;
  grid-template-columns: 140px 1fr 90px;
  gap: ${p => p.theme.space.sm};
  align-items: center;
  padding: 2px ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.radius.sm};
  cursor: ${p => (p.clickable ? 'pointer' : 'default')};

  &:hover {
    background: ${p =>
      p.clickable ? p.theme.tokens.background.secondary : 'transparent'};
  }
`;

const Bar = styled('div')<{variant: 'selection' | 'baseline'}>`
  height: 6px;
  margin: 1px 0;
  border-radius: 3px;
  background: ${p =>
    p.variant === 'selection'
      ? p.theme.tokens.graphics.warning.vibrant
      : p.theme.tokens.graphics.neutral.moderate};
`;
