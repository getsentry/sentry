import type {UseQueryOptions, UseQueryResult} from '@tanstack/react-query';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {defined} from 'sentry/utils/defined';
import {RequestError} from 'sentry/utils/requestError/requestError';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {mergeMetricUnit} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/mergeMetricUnit';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {metricHeatmapApiOptions} from 'sentry/views/explore/metrics/hooks/metricHeatmapApiOptions';
import type {HeatMapBounds} from 'sentry/views/explore/metrics/hooks/metricHeatmapBoundsApiOptions';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

/**
 * The resolved fetch plan for one render, produced by `useMetricHeatMapData` and
 * consumed by the helpers below. `windows.length > 1` means the range was split
 * into pinned chunks; a single window is the un-chunked fast path.
 */
export interface MetricHeatmapPlan {
  /**
   * Full epoch-aligned x-range in ms. Only meaningful when chunked (windows are
   * absolute); `{0, 0}` on the fast path, which merges nothing.
   */
  fullRange: {end: number; start: number};
  intervalMs: number;
  /**
   * The original range was relative → the newest window is the live edge and
   * refetches; historical windows cache forever.
   */
  isRelative: boolean;
  /**
   * Sub-windows to fetch, as drop-in `selection.datetime` replacements. Chunked
   * windows are absolute; the single fast-path window is the original datetime.
   */
  windows: Array<PageFilters['datetime']>;
}

type HeatmapChunkQuery = UseQueryOptions<
  ApiResponse<HeatMapSeries>,
  Error,
  HeatMapSeries
>;

export interface ChunkedHeatmapResult {
  /**
   * A fatal error — every chunk failed. Partial failures do not set this.
   */
  error: Error | null;
  /**
   * At least one chunk is still loading while others have resolved.
   */
  isFetchingMore: boolean;
  /**
   * A chunk failed but others succeeded.
   */
  isPartial: boolean;
  /**
   * The merged, unit-patched grid, present once one chunk resolves.
   */
  series: HeatMapSeries | undefined;
}

// Only retry rate limits; a 500 fails the chunk fast (→ partial render).
const CHUNK_RETRY = (failureCount: number, error: Error) =>
  error instanceof RequestError && error.status === 429 && failureCount < 3;

interface ChunkedMetricHeatmapOptions extends Pick<
  MetricHeatmapPlan,
  'windows' | 'intervalMs' | 'isRelative'
> {
  /**
   * The pinned y-domain from Phase A. Undefined until it resolves; the queries
   * skip-token themselves off via `enabled` until then.
   */
  bounds: HeatMapBounds | undefined;
  enabled: boolean;
  organization: Organization;
  query: string;
  selection: PageFilters;
  traceMetric: TraceMetric;
  interval?: string | null;
  yBuckets?: number | null;
}

/**
 * Builds the full array of chunked heat map requests wholesale — one
 * `/events-heatmap/` query per chunk — ready to spread into
 * `useQueries({queries, combine})`. Mirrors how `metricHeatmapBoundsApiOptions`
 * returns a single query; this returns the chunk array.
 *
 * ---------------------------------------------------------------------------
 * BACKEND CONTRACT (EAP / Snuba) — verified July 2025. Read before you futz.
 * ---------------------------------------------------------------------------
 * 1. TIME ALIGNMENT. Snuba anchors buckets to the request's `start`
 *    (`start + k*granularity`), NOT the epoch, so chunk boundaries must be
 *    epoch-aligned multiples of the interval or adjacent chunks duplicate/drop
 *    the seam. `splitDateTime` guarantees this; the interval must be a
 *    backend-accepted granularity (`VALID_GRANULARITIES`).
 * 2. CACHING. Snuba's result cache key is an MD5 of the SQL (embeds literal
 *    start/end); no server-side quantization or jitter. So stable epoch-aligned
 *    windows are cacheable — hence `staleTime: Infinity` on historical chunks and
 *    ceiling the trailing (live) chunk's end to the interval so its key is stable
 *    within an interval window.
 * 3. SAMPLING. EAP picks a downsampling tier per request from the time range +
 *    estimated rows, so differently-sized chunks could land on different tiers —
 *    noisy/non-uniform `count()`s and biased `min`/`max`. Every chunk (and the
 *    Phase A bounds) runs at HIGHEST_ACCURACY (TIER_1) to stay exact and uniform;
 *    the single-chunk fast path is unpinned and keeps default sampling. If a chunk
 *    is too slow, shrink the chunks (the `splitDateTime` policy), do NOT
 *    re-enable per-chunk downsampling.
 */
export function chunkedMetricHeatmapApiOptions({
  organization,
  selection,
  traceMetric,
  query,
  interval,
  yBuckets,
  bounds,
  enabled,
  windows,
  isRelative,
  intervalMs,
}: ChunkedMetricHeatmapOptions): HeatmapChunkQuery[] {
  const isChunked = windows.length > 1;
  return windows.map((datetime, index) => {
    // The newest window of a relative range is the live edge — refetch it rather
    // than cache forever (a split window is absolute, so it would otherwise be
    // treated as immutable).
    const isTrailingLive = isChunked && isRelative && index === 0;
    return {
      ...metricHeatmapApiOptions({
        organization,
        // Each window is a drop-in datetime; the builder resolves it like any
        // other selection range, so chunk and fast-path share one code path.
        selection: {...selection, datetime},
        traceMetric,
        query,
        interval,
        yBuckets,
        yMin: isChunked ? bounds?.yMin : undefined,
        yMax: isChunked ? bounds?.yMax : undefined,
        sampling: isChunked ? SAMPLING_MODE.HIGH_ACCURACY : undefined,
        staleTime: isChunked ? (isTrailingLive ? intervalMs : Infinity) : undefined,
        enabled,
      }),
      retry: CHUNK_RETRY,
    };
  });
}

/**
 * Builds the `combine` function for `useQueries` that stitches the chunk
 * responses into one dense, unit-patched grid and derives the streaming/partial
 * state.
 *
 * Wrap this in `useMemo` (keyed on the plan + unit) so the returned function
 * stays referentially stable: query-core re-runs `combine` only when the results
 * change or the `combine` reference changes (and `replaceEqualDeep`s the output),
 * so an unstable combine would rebuild the (expensive) merge every render.
 */
export function metricHeatmapCombine({
  isChunked,
  fullRange,
  intervalMs,
  unit,
}: Pick<MetricHeatmapPlan, 'fullRange' | 'intervalMs'> & {
  isChunked: boolean;
  unit: TraceMetric['unit'];
}) {
  const metricUnit = unit ?? undefined;

  return (results: Array<UseQueryResult<HeatMapSeries>>): ChunkedHeatmapResult => {
    const succeeded = results
      .filter(q => q.isSuccess && defined(q.data))
      .map(q => q.data!);
    const succeededCount = results.filter(q => q.isSuccess).length;
    const erroredCount = results.filter(q => q.isError).length;
    const loadingCount = results.filter(
      q => q.isPending && q.fetchStatus === 'fetching'
    ).length;

    const allErrored = results.length > 0 && erroredCount === results.length;
    const error = allErrored ? (results.find(q => q.error)?.error ?? null) : null;

    let series: HeatMapSeries | undefined;
    if (succeeded.length > 0) {
      // Fast path: the single unpinned response is already a dense, ordered grid.
      // Chunked: stitch the chunks into one dense, full-range grid.
      const merged = isChunked
        ? mergeHeatMapChunks(succeeded, {
            xStart: fullRange.start,
            xEnd: fullRange.end,
            intervalMs,
          })
        : succeeded[0]!;
      series = mergeMetricUnit(merged, metricUnit);
    }

    return {
      series,
      error,
      isPartial: isChunked && erroredCount > 0 && succeededCount > 0,
      isFetchingMore: isChunked && succeededCount > 0 && loadingCount > 0,
    };
  };
}

type HeatMapValue = HeatMapSeries['values'][number];

interface HeatMapGrid {
  /**
   * X bucket width in ms (the shared interval).
   */
  intervalMs: number;
  /**
   * Exclusive end of the full x range, in ms.
   */
  xEnd: number;
  /**
   * Start of the full x range, in ms.
   */
  xStart: number;
}

/**
 * Merges the responses of several pinned, epoch-aligned heat map chunks into one
 * dense `HeatMapSeries` covering the whole `grid` range.
 *
 * The heat map positions cells on a category axis whose categories are inferred
 * from the order values appear in the data, and it sizes the grid by how many
 * columns are present. So the merged series must:
 *  - be ordered x-major / y-minor ascending (matching a single-request response),
 *    otherwise chunks render out of order with seams at the boundaries, and
 *  - always span the full x range with a cell per column, otherwise a
 *    partially-loaded set of columns stretches to fill the whole chart.
 *
 * Columns that haven't loaded yet are emitted as empty (`zAxis: null`) cells, so
 * loaded chunks occupy their correct horizontal slice and the rest fills in as
 * chunks resolve. Every chunk shares the same pinned y-domain, so the y buckets
 * come straight from any loaded chunk.
 *
 * Callers must pass only *succeeded* chunks (at least one).
 */
export function mergeHeatMapChunks(
  chunks: HeatMapSeries[],
  grid: HeatMapGrid
): HeatMapSeries {
  if (chunks.length === 0) {
    throw new Error('mergeHeatMapChunks requires at least one chunk');
  }

  const first = chunks[0]!;
  const {xStart, xEnd, intervalMs} = grid;

  // The pinned y bucket lower-bounds are identical across chunks, so any chunk's
  // y values are the full set.
  const yValues = Array.from(new Set(first.values.map(value => value.yAxis))).sort(
    (a, b) => a - b
  );

  // Index every loaded cell by [x,y] and track the z range across the merged set
  // so the color scale reflects everything rendered so far.
  const loaded = new Map<string, HeatMapValue>();
  let zStart: number | null = null;
  let zEnd: number | null = null;
  for (const chunk of chunks) {
    for (const value of chunk.values) {
      loaded.set(`${value.xAxis}|${value.yAxis}`, value);
      if (value.zAxis !== null) {
        zStart = zStart === null ? value.zAxis : Math.min(zStart, value.zAxis);
        zEnd = zEnd === null ? value.zAxis : Math.max(zEnd, value.zAxis);
      }
    }
  }

  const values: HeatMapValue[] = [];
  for (let x = xStart; x < xEnd; x += intervalMs) {
    for (const y of yValues) {
      values.push(loaded.get(`${x}|${y}`) ?? {xAxis: x, yAxis: y, zAxis: null});
    }
  }

  return {
    values,
    meta: {
      xAxis: {
        ...first.meta.xAxis,
        start: xStart,
        end: xEnd,
        bucketCount: Math.round((xEnd - xStart) / intervalMs),
        bucketSize: intervalMs / 1000,
      },
      // The y-axis is identical across pinned chunks; take it wholesale.
      yAxis: first.meta.yAxis,
      zAxis: {
        ...first.meta.zAxis,
        start: zStart ?? 0,
        end: zEnd ?? 0,
      },
    },
  };
}

/**
 * An empty, unit-patched grid for when Phase A resolves but the range has no
 * data, so the "No data" state renders instead of a perpetual spinner.
 */
export function emptyHeatMapSeries(
  startMs: number,
  endMs: number,
  intervalMs: number,
  yBuckets: number,
  unit: TraceMetric['unit']
): HeatMapSeries {
  return mergeMetricUnit(
    {
      values: [],
      meta: {
        xAxis: {
          name: 'time',
          start: startMs,
          end: endMs,
          bucketCount: 0,
          bucketSize: intervalMs / 1000,
        },
        yAxis: {
          name: 'value',
          start: 0,
          end: 0,
          bucketCount: yBuckets,
          bucketSize: 0,
          valueType: 'number',
          valueUnit: null,
        },
        zAxis: {name: 'count()', start: 0, end: 0},
      },
    },
    unit ?? undefined
  );
}
