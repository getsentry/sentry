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
  const validDims = defined(yBuckets) && yBuckets > 0;
  const intervalMs = defined(interval) ? intervalToMilliseconds(interval) : 0;

  // Partition the range into per-window request params once per filter/interval
  // change, so it's stable across renders (`partitionDateTimeIntoHeatMapWindows` reads
  // Date.now() for relative ranges — pinning it here avoids re-partitioning, and
  // relative windows stay relative so the backend still re-resolves now per fetch).
  const {windows, timeDomain} = useMemo(
    () =>
      partitionDateTimeIntoHeatMapWindows(selection.datetime, interval, 'progressive'),
    [interval, selection.datetime]
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

  // Bounds only exist to pin a shared y-domain across chunks. They're usable once
  // the query resolves to a real range; "settled" also covers the empty and
  // errored outcomes, where we can't pin and degrade to a single request.
  const bounds = boundsQuery.data ?? undefined;
  const canPin = isChunked && boundsQuery.isSuccess && defined(bounds);
  const boundsSettled = isChunked && (boundsQuery.isSuccess || boundsQuery.isError);

  // Phase B, fetch the heat map itself once we're ready (narrow range: right
  // away; chunked: after bounds settle either way). When we can't pin — a narrow
  // range, or bounds that came back empty or errored — fetch one unpinned request
  // over the whole selection, materialized here rather than carried on the plan.
  const shouldFetch =
    enabled && validDims && windows.length > 0 && (isChunked ? boundsSettled : true);
  let activeWindows = windows;
  if (shouldFetch && isChunked && !canPin) {
    activeWindows = [dateTimeAsHeatMapWindow(selection.datetime)];
  }

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
          // Pin the shared y-domain only when chunking, so every chunk has aligned
          // y-buckets and can be merged. The fallback request stays unpinned.
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
    isPending: isPending,
    isFetching: isFetching,
    isPartial,
  } = useQueries({queries, combine});

  // Patch the metric unit onto the Y-axis, since the server can't infer this
  const series = chunkSeries
    ? mergeMetricUnit(chunkSeries, traceMetric.unit ?? undefined)
    : chunkSeries;
  // A failed bounds query isn't fatal — it degrades to the single-request
  // fallback above, so only the heat map request's own error matters.
  const error = chunkError;

  return {
    series,
    error,
    isPending: isPending || boundsQuery.isPending,
    isFetching: isFetching || boundsQuery.isFetching,
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
