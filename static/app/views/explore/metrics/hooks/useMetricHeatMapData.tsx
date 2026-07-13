import {useMemo} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {mergeMetricUnit} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/mergeMetricUnit';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {metricBoundsApiOptions} from 'sentry/views/explore/metrics/hooks/metricBoundsApiOptions';
import {metricHeatmapApiOptions} from 'sentry/views/explore/metrics/hooks/metricHeatmapApiOptions';
import {combinePartitionedHeatmapWindows} from 'sentry/views/explore/metrics/hooks/metricHeatmapCombine';
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

/**
 * Heat map data source for Explore and Dashboards.
 *
 * Wide ranges are fetched in two phases. Phase A learns the global y-domain with
 * one cheap `min`/`max` aggregate (`metricBoundsApiOptions`). Phase B fires one
 * pinned `/events-heatmap/` request per partition window and `combine`s them into
 * one dense grid (`metricHeatmapCombine`). The metric unit is patched onto the
 * merged grid here, once. A failed chunk degrades to a partial render.
 *
 * Narrow ranges skip Phase A and issue one unpinned request over the selection.
 * A wide range whose Phase A finds no data falls back to that same single request,
 * so a real (empty) response drives "No data" — no synthesized grid.
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
  const {windows, timeDomain, selectionWindow} = useMemo(
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
  const boundsQuery = useQuery({
    ...metricBoundsApiOptions({
      organization,
      selection,
      traceMetric,
      query,
      sampling: HEATMAP_CHUNK_SAMPLING_MODE,
    }),
    enabled: enabled && validDims && chunked,
  });

  const boundsResolved = chunked && boundsQuery.isSuccess;
  const boundsEmpty = boundsResolved && boundsQuery.data === null;
  const bounds = boundsQuery.data ?? undefined;

  // Phase B — build the queries only once we're ready to fire (fast path: right
  // away; chunked: after bounds resolve). A wide range whose bounds came back
  // empty falls back to one unpinned query over the whole selection — like the
  // fast path — so a real empty response renders "No data" without a fake grid.
  const shouldFetch =
    enabled && validDims && windows.length > 0 && (chunked ? boundsResolved : true);
  const activeWindows = boundsEmpty ? [selectionWindow] : windows;
  const queries = shouldFetch
    ? activeWindows.map(timeParams =>
        metricHeatmapApiOptions({
          organization,
          selection,
          timeParams,
          traceMetric,
          query,
          interval,
          yBuckets,
          // Pin the domain + tier only when we have real bounds (chunking) so every
          // chunk shares aligned buckets on one exact tier. The fast path and the
          // empty fallback have no bounds and stay unpinned.
          yMin: bounds?.min,
          yMax: bounds?.max,
          sampling: defined(bounds) ? HEATMAP_CHUNK_SAMPLING_MODE : undefined,
        })
      )
    : [];
  const combine = useMemo(
    () => combinePartitionedHeatmapWindows({timeDomain, intervalMs}),
    [timeDomain, intervalMs]
  );
  const {
    series: chunkSeries,
    error: chunkError,
    isPartial,
    isFetchingMore,
  } = useQueries({queries, combine});

  // Patch the metric unit onto the y-axis once, here — the combiner doesn't need
  // to know about units.
  const series = chunkSeries
    ? mergeMetricUnit(chunkSeries, traceMetric.unit ?? undefined)
    : chunkSeries;
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
