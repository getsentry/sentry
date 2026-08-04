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
import {
  dateTimeAsHeatMapWindow,
  partitionDateTimeIntoHeatMapWindows,
} from 'sentry/views/explore/metrics/hooks/partitionHeatMapWindows';
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
 * A wide range whose bounds come back empty — or whose bounds request fails —
 * degrades to that same single request instead of erroring.
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
  const intervalMs = defined(interval) ? intervalToMilliseconds(interval) : 0;
  const validDimensions = defined(yBuckets) && yBuckets > 0 && intervalMs > 0;

  // Partition the range into per-window request params
  const {windows, timeDomain} = useMemo(
    () =>
      partitionDateTimeIntoHeatMapWindows(selection.datetime, interval, 'progressive'),
    [interval, selection.datetime]
  );

  // Optional Phase A, fetch Y-axis range if there is more than one window
  const isBoundsQueryNeeded = windows.length > 1;

  const boundsQuery = useQuery({
    ...metricBoundsApiOptions({
      organization,
      selection,
      traceMetric,
      query,
    }),
    enabled: enabled && isBoundsQueryNeeded,
  });

  // Bounds only exist to pin a shared Y-axis domain across chunks. They're
  // usable once the query has settled. If successful, we will pin the windows.
  // If failed, we will swap the calculated windows with one global window, and
  // turn pinning off.
  const bounds = boundsQuery.data ?? undefined;
  const boundsSettled = boundsQuery.isSuccess || boundsQuery.isError;
  const didBoundsComeBack = boundsSettled && boundsQuery.isSuccess && defined(bounds);

  // Phase B, fetch the heat map itself once we're ready

  // When we can't pin when e.g., bounds that came back empty or errored — fetch
  // one unpinned request over the whole selection
  let activeWindows = windows;
  if (isBoundsQueryNeeded && boundsSettled && !didBoundsComeBack) {
    activeWindows = [dateTimeAsHeatMapWindow(selection.datetime)];
  }

  // Construct all the needed queries, and let them wait for the bounds query to
  // resolve if it's needed. If it doesn't resolve correctly the active windows
  // have been swapped for the one global window.
  const queries = activeWindows.map(timeWindow => ({
    ...metricHeatMapApiOptions({
      organization,
      selection,
      timeWindow,
      traceMetric,
      query,
      interval,
      yBuckets,
      // Pin the shared y-domain only when chunking, so every chunk has aligned
      // y-buckets and can be merged. The fallback request stays unpinned.
      yMin: bounds?.min,
      yMax: bounds?.max,
    }),
    // We can run these queries once we have valid dimensions, and we either
    // tried to get the bounds, or they weren't needed
    enabled: enabled && validDimensions && (isBoundsQueryNeeded ? boundsSettled : true),
  }));

  const combine = useMemo(
    () => makePartitionedHeatMapWindowCombiner({timeDomain, intervalMs}),
    [timeDomain, intervalMs]
  );

  const {
    series: chunkSeries,
    error: chunkError,
    isPending: areChunksPending,
    isFetching: areChunksFetching,
    isPartial,
  } = useQueries({queries, combine});

  // Patch the metric unit onto the Y-axis, since the server can't infer this
  const series = chunkSeries
    ? mergeMetricUnit(chunkSeries, traceMetric.unit ?? undefined)
    : chunkSeries;

  return {
    series,
    // A failed bounds query isn't fatal since it degrades to the single-request
    // fallback above, so only the heat map request's own error matters
    error: chunkError,
    // The bounds query might be pending because it's waiting for dimensions, or
    // because it's not needed. Its pending state is only taken into account if
    // it's actually ever going to be needed
    isPending: areChunksPending || (isBoundsQueryNeeded && boundsQuery.isPending),
    isFetching: areChunksFetching || boundsQuery.isFetching,
    isPartial,
  };
}

export interface MetricHeatMapData {
  error: Error | null;
  isFetching: boolean;
  /**
   * A chunk failed but others succeeded; the grid is rendered with a gap.
   */
  isPartial: boolean;
  isPending: boolean;
  /**
   * The merged, unit-patched grid. Present as soon as one chunk resolves.
   */
  series: HeatMapSeries | undefined;
}
