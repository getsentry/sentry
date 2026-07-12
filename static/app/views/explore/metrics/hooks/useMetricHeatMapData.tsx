import {useMemo} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useTimeChunks} from 'sentry/utils/chunkedTimeRange/useTimeChunks';
import {defined} from 'sentry/utils/defined';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {
  chunkedMetricHeatmapApiOptions,
  emptyHeatMapSeries,
  metricHeatmapCombine,
} from 'sentry/views/explore/metrics/hooks/chunkedMetricHeatmap';
import {
  metricHeatmapBoundsApiOptions,
  reduceHeatMapBounds,
} from 'sentry/views/explore/metrics/hooks/metricHeatmapBoundsApiOptions';
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

/**
 * Heat map data source for Explore and Dashboards.
 *
 * Wide ranges are fetched in two phases. Phase A learns the global y-domain with
 * one cheap `min`/`max` aggregate (`metricHeatmapBoundsApiOptions`). Phase B
 * builds the pinned, chunked requests (`chunkedMetricHeatmapApiOptions`) and lets
 * `useQueries` fire + `combine` them into one dense grid (`metricHeatmapCombine`).
 * A failed chunk degrades to a partial render; narrow ranges skip Phase A and
 * issue one unpinned request over the selection.
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
  const resolved = useTimeChunks({selection, interval: validDims ? interval : null});
  const {chunks, fullRange, intervalMs} = resolved;
  const chunked = chunks.length > 1;

  // Phase A — global y-domain. Only fired when we actually chunk.
  const boundsApiOptions = metricHeatmapBoundsApiOptions({
    organization,
    selection,
    traceMetric,
    query,
    interval,
    enabled: enabled && chunked,
  });
  const boundsQuery = useQuery({
    ...boundsApiOptions,
    select: data => reduceHeatMapBounds(boundsApiOptions.select!(data)),
  });

  const boundsResolved = chunked && boundsQuery.isSuccess;
  const boundsEmpty = boundsResolved && boundsQuery.data === null;
  const domainReady = boundsResolved && boundsQuery.data !== null;

  // Phase B — pinned chunk requests + combine, both produced wholesale.
  const queries = chunkedMetricHeatmapApiOptions({
    ...resolved,
    organization,
    selection,
    traceMetric,
    query,
    interval,
    yBuckets,
    bounds: boundsQuery.data ?? undefined,
    enabled: enabled && validDims && (chunked ? domainReady : true),
  });
  const combine = useMemo(
    () => metricHeatmapCombine({...resolved, unit: traceMetric.unit}),
    [resolved, traceMetric.unit]
  );
  const {
    data,
    isPartial,
    isFetchingMore,
    error: chunkError,
  } = useQueries({queries, combine});

  // Phase A resolved but the range has no data → empty grid so "No data" shows.
  const series = boundsEmpty
    ? emptyHeatMapSeries(
        fullRange.start,
        fullRange.end,
        intervalMs,
        yBuckets ?? 0,
        traceMetric.unit
      )
    : data;
  const error = boundsQuery.error ?? chunkError;

  return {
    series,
    error,
    isPartial,
    isFetchingMore,
    isPending: !series && !error,
  };
}
