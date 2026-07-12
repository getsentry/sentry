import {useMemo} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {
  chunkedMetricHeatmapApiOptions,
  emptyHeatMapSeries,
  metricHeatmapCombine,
  type MetricHeatmapChunks,
} from 'sentry/views/explore/metrics/hooks/chunkedMetricHeatmap';
import {computeTimeChunks} from 'sentry/views/explore/metrics/hooks/computeTimeChunks';
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

  // Resolve the range to concrete timestamps and split it into epoch-aligned
  // chunks once per filter/interval change. Date.now() is captured once here (for
  // relative ranges); epoch-snapping keeps historical boundaries stable across
  // renders, so only the live edge moves.
  const resolved = useMemo((): MetricHeatmapChunks => {
    const empty: MetricHeatmapChunks = {
      chunks: [],
      isRelative: false,
      fullRange: {start: 0, end: 0},
      intervalMs: 0,
    };
    if (!validDims || !defined(interval)) {
      return empty;
    }
    const intervalMs = intervalToMilliseconds(interval);
    if (intervalMs <= 0) {
      return empty;
    }

    const normalized = normalizeDateTimeParams(selection.datetime);
    let start: number;
    let end: number;
    let isRelative: boolean;
    if (defined(normalized.start) && defined(normalized.end)) {
      // normalizeDateTimeParams emits UTC strings without a `Z`, so parse them
      // as UTC (not local) to get the correct epoch ms.
      start = moment.utc(normalized.start).valueOf();
      end = moment.utc(normalized.end).valueOf();
      isRelative = false;
    } else {
      end = Date.now();
      start = end - getDiffInMinutes(selection.datetime) * 60 * 1000;
      isRelative = true;
    }

    const chunks = computeTimeChunks({start, end, interval});
    return {
      chunks,
      isRelative,
      intervalMs,
      fullRange: {
        start: chunks.length ? Math.min(...chunks.map(c => c.start)) : 0,
        end: chunks.length ? Math.max(...chunks.map(c => c.end)) : 0,
      },
    };
    // Date.now() is intentionally captured once per filter/interval change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    validDims,
    interval,
    selection.datetime.start,
    selection.datetime.end,
    selection.datetime.period,
    selection.datetime.utc,
  ]);

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
    series: chunkSeries,
    error: chunkError,
    isPartial,
    isFetchingMore,
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
