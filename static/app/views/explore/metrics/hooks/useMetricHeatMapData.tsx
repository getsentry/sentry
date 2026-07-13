import {useMemo} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {progressivelySplitDateTimeRange} from 'sentry/components/pageFilters/progressivelySplitDateTimeRange';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {mergeMetricUnit} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/mergeMetricUnit';
import {
  chunkedMetricHeatmapApiOptions,
  emptyHeatMapSeries,
  type MetricHeatmapPlan,
} from 'sentry/views/explore/metrics/hooks/chunkedMetricHeatmap';
import {
  metricBoundsApiOptions,
  reduceMetricBounds,
} from 'sentry/views/explore/metrics/hooks/metricBoundsApiOptions';
import {metricHeatmapCombine} from 'sentry/views/explore/metrics/hooks/metricHeatmapCombine';
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
 * one cheap `min`/`max` aggregate (`metricBoundsApiOptions`). Phase B builds the
 * pinned, chunked requests (`chunkedMetricHeatmapApiOptions`) and lets `useQueries`
 * fire + `combine` them into one dense grid (`metricHeatmapCombine`). The metric
 * unit is patched onto the merged grid here, once. A failed chunk degrades to a
 * partial render; narrow ranges skip Phase A and issue one unpinned request over
 * the selection.
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

  // Split the range into epoch-aligned sub-windows once per filter/interval
  // change. Date.now() (inside progressivelySplitDateTimeRange, for relative
  // ranges) is captured once here; epoch-snapping keeps historical boundaries
  // stable across renders, so only the live edge moves.
  const plan = useMemo((): MetricHeatmapPlan => {
    if (!defined(interval)) {
      return EMPTY_PLAN;
    }
    const intervalMs = intervalToMilliseconds(interval);
    if (intervalMs <= 0) {
      return EMPTY_PLAN;
    }

    const windows = progressivelySplitDateTimeRange(selection.datetime, interval);
    const isRelative = !defined(normalizeDateTimeParams(selection.datetime).start);
    // Absolute windows carry Dates; parse via moment for the merge grid's range.
    // A single (fast-path) window merges nothing, so its range is irrelevant.
    const fullRange =
      windows.length > 1
        ? {
            start: Math.min(
              ...windows.map(w => moment.utc(w.start ?? undefined).valueOf())
            ),
            end: Math.max(...windows.map(w => moment.utc(w.end ?? undefined).valueOf())),
          }
        : {start: 0, end: 0};
    return {windows, fullRange, intervalMs, isRelative};
    // Date.now() is intentionally captured once per filter/interval change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    interval,
    selection.datetime.start,
    selection.datetime.end,
    selection.datetime.period,
    selection.datetime.utc,
  ]);

  const {windows, fullRange, intervalMs, isRelative} = plan;
  const chunked = windows.length > 1;

  // Phase A — global y-domain. Only fired when we actually chunk.
  const boundsApiOptions = metricBoundsApiOptions({
    organization,
    selection,
    traceMetric,
    query,
    interval,
    enabled: enabled && validDims && chunked,
  });
  const boundsQuery = useQuery({
    ...boundsApiOptions,
    select: data => reduceMetricBounds(boundsApiOptions.select!(data)),
  });

  const boundsResolved = chunked && boundsQuery.isSuccess;
  const boundsEmpty = boundsResolved && boundsQuery.data === null;
  const domainReady = boundsResolved && boundsQuery.data !== null;

  // Phase B — pinned chunk requests + combine, both produced wholesale.
  const queries = chunkedMetricHeatmapApiOptions({
    windows,
    isRelative,
    intervalMs,
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
    () => metricHeatmapCombine({isChunked: chunked, fullRange, intervalMs}),
    [chunked, fullRange, intervalMs]
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

const EMPTY_PLAN: MetricHeatmapPlan = {
  windows: [],
  fullRange: {start: 0, end: 0},
  intervalMs: 0,
  isRelative: false,
};
