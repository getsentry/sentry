import type {UseQueryOptions} from '@tanstack/react-query';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {defined} from 'sentry/utils/defined';
import {RequestError} from 'sentry/utils/requestError/requestError';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {MetricBounds} from 'sentry/views/explore/metrics/hooks/metricBoundsApiOptions';
import {metricHeatmapApiOptions} from 'sentry/views/explore/metrics/hooks/metricHeatmapApiOptions';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

// The sampling tier for chunked requests AND their pinned bounds — see the
// BACKEND CONTRACT note below. Both must match so the pinned domain encloses
// exactly what the chunks scan; keep them tied to this one constant.
export const HEATMAP_CHUNK_SAMPLING_MODE = SAMPLING_MODE.HIGH_ACCURACY;

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
   * The metric value range from Phase A, pinned onto the y-axis (and the signal
   * that we're chunking). Undefined on the fast path or until Phase A resolves —
   * the caller only builds these queries once it's ready to run them.
   */
  bounds: MetricBounds | undefined;
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
 *    the seam. `partitionDateTimeRange` guarantees this; the interval must be a
 *    backend-accepted granularity (`VALID_GRANULARITIES`).
 * 2. CACHING. Snuba's result cache key is an MD5 of the SQL (embeds literal
 *    start/end); no server-side quantization or jitter. So stable epoch-aligned
 *    windows are cacheable — hence `staleTime: Infinity` (the builder default for
 *    absolute windows) on historical chunks, and only the trailing (live) chunk
 *    of a relative range refetches on its interval.
 * 3. SAMPLING. EAP picks a downsampling tier per request from the time range +
 *    estimated rows, so differently-sized chunks could land on different tiers —
 *    noisy/non-uniform `count()`s and biased `min`/`max`. Every chunk runs at
 *    `HEATMAP_CHUNK_SAMPLING_MODE` (HIGHEST_ACCURACY / TIER_1) to stay exact and
 *    uniform. The Phase A bounds MUST use that SAME sampling: the heat map
 *    endpoint computes its own y-bounds at its data query's sampling mode
 *    (`snuba_params.sampling_mode`), and `min`/`max` are the extremes of scanned
 *    rows (not extrapolated), so a lower-tier bounds scan would under-cover and
 *    clip the chunks' extreme buckets. The single-chunk fast path is unpinned and
 *    keeps default sampling. If a chunk is too slow, shrink the chunks (the
 *    `partitionDateTimeRange` strategy), do NOT re-enable per-chunk downsampling.
 */
export function chunkedMetricHeatmapApiOptions({
  organization,
  selection,
  traceMetric,
  query,
  interval,
  yBuckets,
  bounds,
  windows,
  isRelative,
  intervalMs,
}: ChunkedMetricHeatmapOptions): HeatmapChunkQuery[] {
  return windows.map((datetime, index) => {
    // The newest window of a relative range is the live edge — refetch it rather
    // than cache forever (a split window is absolute, so it would otherwise get
    // the default `Infinity` staleTime). Every other window uses that default.
    const isTrailingLive = isRelative && index === 0;
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
        // When we have bounds we're chunking: pin the domain and the sampling
        // tier so every chunk shares aligned buckets on one exact tier.
        yMin: bounds?.min,
        yMax: bounds?.max,
        sampling: defined(bounds) ? HEATMAP_CHUNK_SAMPLING_MODE : undefined,
        staleTime: isTrailingLive ? intervalMs : undefined,
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
