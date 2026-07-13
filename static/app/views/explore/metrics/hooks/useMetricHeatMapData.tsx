import {useMemo} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {RequestError} from 'sentry/utils/requestError/requestError';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {mergeMetricUnit} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/mergeMetricUnit';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {metricBoundsApiOptions} from 'sentry/views/explore/metrics/hooks/metricBoundsApiOptions';
import {metricHeatmapApiOptions} from 'sentry/views/explore/metrics/hooks/metricHeatmapApiOptions';
import {
  emptyHeatMapSeries,
  metricHeatmapCombine,
} from 'sentry/views/explore/metrics/hooks/metricHeatmapCombine';
import {partitionHeatmapWindows} from 'sentry/views/explore/metrics/hooks/partitionHeatmapWindows';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

interface UseMetricHeatMapDataOptions {
  enabled: boolean;
  organization: Organization;
  query: string;
  selection: PageFilters;
  traceMetric: TraceMetric;
  interval?: string | null;
  yBuckets?: number | null;
}

// Chunked requests AND their Phase A bounds run at this tier, and they MUST match:
// the heat map endpoint computes its own y-bounds at its data query's sampling
// mode, and `min`/`max` are the extremes of *scanned* rows (not extrapolated), so
// a lower-tier bounds scan would under-cover and clip the chunks' extreme buckets.
// Verified against the backend (rpc_dataset_common / snuba aggregation), July 2025.
const HEATMAP_CHUNK_SAMPLING_MODE = SAMPLING_MODE.HIGH_ACCURACY;

// Only retry rate limits; a 500 fails the chunk fast so the grid degrades to a
// partial render immediately rather than after the default 3 retries.
const CHUNK_RETRY = (failureCount: number, error: Error) =>
  error instanceof RequestError && error.status === 429 && failureCount < 3;

/**
 * Heat map data source for Explore and Dashboards.
 *
 * Wide ranges are fetched in two phases. Phase A learns the global y-domain with
 * one cheap `min`/`max` aggregate (`metricBoundsApiOptions`). Phase B fires one
 * pinned `/events-heatmap/` request per partition window and `combine`s them into
 * one dense grid (`metricHeatmapCombine`). The metric unit is patched onto the
 * merged grid here, once. A failed chunk degrades to a partial render; narrow
 * ranges skip Phase A and issue one unpinned request over the selection.
 */
export function useMetricHeatMapData({
  organization,
  selection,
  traceMetric,
  query,
  interval,
  yBuckets,
  enabled,
}: UseMetricHeatMapDataOptions): MetricHeatMapData {
  const validDims = defined(yBuckets) && yBuckets > 0;
  const intervalMs = defined(interval) ? intervalToMilliseconds(interval) : 0;

  // Partition the range into per-window request params once per filter/interval
  // change, so it's stable across renders (`partitionHeatmapWindows` reads
  // Date.now() for relative ranges — pinning it here avoids re-partitioning, and
  // relative windows stay relative so the backend still re-resolves now per fetch).
  const {windows, fullRange} = useMemo(
    // Progressive: the recent region loads first in the smallest window.
    () => partitionHeatmapWindows(selection.datetime, interval, 'progressive'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      interval,
      selection.datetime.start,
      selection.datetime.end,
      selection.datetime.period,
      selection.datetime.utc,
    ]
  );
  const chunked = windows.length > 1;

  // Phase A — global y-domain, only fetched when we actually chunk.
  const boundsQuery = useQuery(
    metricBoundsApiOptions({
      organization,
      selection,
      traceMetric,
      query,
      interval,
      sampling: HEATMAP_CHUNK_SAMPLING_MODE,
      enabled: enabled && validDims && chunked,
    })
  );

  const boundsResolved = chunked && boundsQuery.isSuccess;
  const boundsEmpty = boundsResolved && boundsQuery.data === null;
  const domainReady = boundsResolved && boundsQuery.data !== null;

  // Phase B — one pinned request per window. Build the queries only once we're
  // ready to run them (fast path: right away; chunked: after the domain resolves);
  // an empty array means "nothing to fetch yet" (disabled, or no interval).
  const shouldFetch =
    enabled && validDims && windows.length > 0 && (chunked ? domainReady : true);
  const bounds = boundsQuery.data ?? undefined;
  const queries = shouldFetch
    ? windows.map(timeParams => ({
        ...metricHeatmapApiOptions({
          organization,
          selection,
          timeParams,
          traceMetric,
          query,
          interval,
          yBuckets,
          // With bounds we're chunking: pin the domain + tier so every chunk shares
          // aligned buckets on one exact tier. Fast path (no bounds) stays unpinned.
          yMin: bounds?.min,
          yMax: bounds?.max,
          sampling: defined(bounds) ? HEATMAP_CHUNK_SAMPLING_MODE : undefined,
        }),
        retry: CHUNK_RETRY,
      }))
    : [];
  const combine = useMemo(
    () => metricHeatmapCombine({fullRange, intervalMs}),
    [fullRange, intervalMs]
  );
  const {
    series: chunkSeries,
    error: chunkError,
    isPartial,
    isFetchingMore,
  } = useQueries({queries, combine});

  // Phase A resolved but the range has no data → empty grid so "No data" shows.
  const merged = boundsEmpty
    ? emptyHeatMapSeries(fullRange.start, fullRange.end, intervalMs, yBuckets ?? 0)
    : chunkSeries;
  // Patch the metric unit onto the y-axis once, here — neither the combiner nor
  // the empty-grid builder needs to know about units.
  const series = merged ? mergeMetricUnit(merged, traceMetric.unit ?? undefined) : merged;
  const error = boundsQuery.error ?? chunkError;

  return {
    series,
    error,
    isPartial,
    isFetchingMore,
    isPending: !series && !error,
  };
}

export interface MetricHeatMapData {
  /**
   * A fatal error — Phase A failed, all chunks failed, or (fast path) the single
   * request failed. Partial chunk failures do NOT set this.
   */
  error: Error | null;
  /**
   * At least one chunk is still loading while others have already resolved —
   * i.e. the grid is painting progressively.
   */
  isFetchingMore: boolean;
  /**
   * A chunk failed but others succeeded; the grid is rendered with a gap.
   */
  isPartial: boolean;
  /**
   * Nothing to render yet and no fatal error.
   */
  isPending: boolean;
  /**
   * The merged, unit-patched grid. Present as soon as one chunk resolves.
   */
  series: HeatMapSeries | undefined;
}
