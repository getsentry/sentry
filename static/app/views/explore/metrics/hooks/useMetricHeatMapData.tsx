import {useMemo} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {mergeMetricUnit} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/mergeMetricUnit';
import {metricBoundsApiOptions} from 'sentry/views/explore/metrics/hooks/metricBoundsApiOptions';
import {metricHeatMapApiOptions} from 'sentry/views/explore/metrics/hooks/metricHeatMapApiOptions';
import {makePartitionedHeatMapWindowCombiner} from 'sentry/views/explore/metrics/hooks/metricHeatMapCombine';
import {partitionDateTimeIntoHeatMapWindows} from 'sentry/views/explore/metrics/hooks/partitionHeatMapWindows';
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

/**
 * Heat map data source for Explore and Dashboards.
 *
 * Wide ranges are fetched in two phases. Phase A learns the global y-domain
 * with one cheap `min`/`max` aggregate (`metricBoundsApiOptions`). Phase B
 * fires one pinned `/events-heatmap/` request per partition window and
 * `combine`s them into one grid (`metricHeatMapCombine`). The metric unit is
 * patched onto the merged grid here, once.
 *
 * Narrow ranges skip Phase A and issue one unpinned request over the selection.
 * A wide range whose Phase A finds no data falls back to that same single request.
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
  // change, so it's stable across renders (`partitionDateTimeIntoHeatMapWindows` reads
  // Date.now() for relative ranges — pinning it here avoids re-partitioning, and
  // relative windows stay relative so the backend still re-resolves now per fetch).
  const {windows, timeDomain} = useMemo(
    () =>
      partitionDateTimeIntoHeatMapWindows(selection.datetime, interval, 'progressive'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      interval,
      selection.datetime.start,
      selection.datetime.end,
      selection.datetime.period,
      selection.datetime.utc,
    ]
  );

  const isChunked = windows.length > 1;

  // Phase A, fetch Y-axis range
  const boundsQuery = useQuery({
    ...metricBoundsApiOptions({
      organization,
      selection,
      traceMetric,
      query,
    }),
    enabled: enabled && validDims && isChunked,
  });

  const boundsResolved = isChunked && boundsQuery.isSuccess;
  const boundsEmpty = boundsResolved && boundsQuery.data === null;
  const bounds = boundsQuery.data ?? undefined;

  // Phase B, build the queries to fetch the actual heat map chunks. When the
  // range is empty (bounds resolved to nothing), fall back to a single window so
  // one real (empty) response drives "No data".
  const shouldFetch =
    enabled && validDims && windows.length > 0 && (isChunked ? boundsResolved : true);
  const activeWindows = boundsEmpty ? windows.slice(0, 1) : windows;

  const queries = shouldFetch
    ? activeWindows.map(timeWindow =>
        metricHeatMapApiOptions({
          organization,
          selection,
          timeWindow,
          traceMetric,
          query,
          interval,
          yBuckets,
          // Pin the shared y-domain when chunking so every chunk has aligned
          // y-buckets and can be merged. The fast path and empty fallback have no
          // bounds and stay unpinned.
          yMin: bounds?.min,
          yMax: bounds?.max,
        })
      )
    : [];

  const combine = useMemo(
    () => makePartitionedHeatMapWindowCombiner({timeDomain, intervalMs}),
    [timeDomain, intervalMs]
  );

  const {
    series: chunkSeries,
    error: chunkError,
    isPartial,
    isFetchingMore,
  } = useQueries({queries, combine});

  // Patch the metric unit onto the Y-axis, since the server can't infer this
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
  error: Error | null;
  /**
   * At least one chunk is still loading while others have already resolved.
   * i.e., the grid is painting progressively.
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
