import type {UseQueryOptions} from '@tanstack/react-query';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {RequestError} from 'sentry/utils/requestError/requestError';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {MetricBounds} from 'sentry/views/explore/metrics/hooks/metricBoundsApiOptions';
import {metricHeatmapApiOptions} from 'sentry/views/explore/metrics/hooks/metricHeatmapApiOptions';
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

// Only retry rate limits; a 500 fails the chunk fast (→ partial render).
const CHUNK_RETRY = (failureCount: number, error: Error) =>
  error instanceof RequestError && error.status === 429 && failureCount < 3;

interface ChunkedMetricHeatmapOptions extends Pick<
  MetricHeatmapPlan,
  'windows' | 'intervalMs' | 'isRelative'
> {
  /**
   * The metric value range from Phase A, pinned onto the y-axis. Undefined until
   * it resolves; the queries skip-token themselves off via `enabled` until then.
   */
  bounds: MetricBounds | undefined;
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
 * `useQueries({queries, combine})`. Mirrors how `metricBoundsApiOptions` returns
 * a single query; this returns the chunk array.
 *
 * ---------------------------------------------------------------------------
 * BACKEND CONTRACT (EAP / Snuba) — verified July 2025. Read before you futz.
 * ---------------------------------------------------------------------------
 * 1. TIME ALIGNMENT. Snuba anchors buckets to the request's `start`
 *    (`start + k*granularity`), NOT the epoch, so chunk boundaries must be
 *    epoch-aligned multiples of the interval or adjacent chunks duplicate/drop
 *    the seam. `progressivelySplitDateTimeRange` guarantees this; the interval must be a
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
 *    is too slow, shrink the chunks (the `progressivelySplitDateTimeRange` policy), do NOT
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
        yMin: isChunked ? bounds?.min : undefined,
        yMax: isChunked ? bounds?.max : undefined,
        sampling: isChunked ? SAMPLING_MODE.HIGH_ACCURACY : undefined,
        staleTime: isChunked ? (isTrailingLive ? intervalMs : Infinity) : undefined,
        enabled,
      }),
      retry: CHUNK_RETRY,
    };
  });
}

/**
 * An empty grid for when Phase A resolves but the range has no data, so the "No
 * data" state renders instead of a perpetual spinner. The metric unit is patched
 * on by the caller.
 */
export function emptyHeatMapSeries(
  startMs: number,
  endMs: number,
  intervalMs: number,
  yBuckets: number
): HeatMapSeries {
  return {
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
  };
}
