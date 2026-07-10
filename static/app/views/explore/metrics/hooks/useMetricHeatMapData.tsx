import {useMemo} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {RequestError} from 'sentry/utils/requestError/requestError';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {mergeMetricUnit} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/mergeMetricUnit';
import {computeHeatMapChunks} from 'sentry/views/explore/metrics/hooks/computeHeatMapChunks';
import {mergeHeatMapChunks} from 'sentry/views/explore/metrics/hooks/mergeHeatMapChunks';
import {metricHeatmapApiOptions} from 'sentry/views/explore/metrics/hooks/metricHeatmapApiOptions';
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

const CHUNK_RETRY = (failureCount: number, error: Error) =>
  error instanceof RequestError && error.status === 429 && failureCount < 3;

/**
 * Shared heat map data source for Explore and Dashboards.
 *
 * Wide ranges are fetched in two phases: Phase A learns the global y-domain with
 * one cheap `min`/`max` aggregate, then Phase B fires several epoch-aligned,
 * time-chunked heat map requests in parallel — each pinned to that domain so the
 * buckets align — and streams them into one merged grid as they resolve. A
 * failed chunk degrades to a partial render instead of failing the whole widget.
 *
 * Narrow ranges (a single chunk) skip Phase A entirely and issue one unpinned
 * request over the selection, identical to the pre-chunking behavior.
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
  // Resolve the range to concrete timestamps and split it into chunks once per
  // filter/dimension change. Epoch-snapping (inside computeHeatMapChunks) keeps
  // the historical boundaries stable across renders; only the live edge moves.
  const {chunks, chunked, isRelative, startMs, endMs, intervalMs} = useMemo(() => {
    const emptyResult = {
      chunks: [],
      chunked: false,
      isRelative: false,
      startMs: 0,
      endMs: 0,
      intervalMs: 0,
    };
    if (!defined(interval) || !defined(yBuckets) || yBuckets <= 0) {
      return emptyResult;
    }
    const ms = intervalToMilliseconds(interval);
    if (ms <= 0) {
      return emptyResult;
    }

    const normalized = normalizeDateTimeParams(selection.datetime);
    let start: number;
    let end: number;
    let relative: boolean;
    if (defined(normalized.start) && defined(normalized.end)) {
      // normalizeDateTimeParams emits UTC strings without a `Z`, so parse them
      // as UTC (not local) to get the correct epoch ms.
      start = moment.utc(normalized.start).valueOf();
      end = moment.utc(normalized.end).valueOf();
      relative = false;
    } else {
      end = Date.now();
      start = end - getDiffInMinutes(selection.datetime) * 60 * 1000;
      relative = true;
    }

    const computed = computeHeatMapChunks({start, end, interval});
    return {
      chunks: computed,
      chunked: computed.length > 1,
      isRelative: relative,
      startMs: start,
      endMs: end,
      intervalMs: ms,
    };
    // Date.now() is intentionally captured once per filter/dimension change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selection.datetime.start,
    selection.datetime.end,
    selection.datetime.period,
    selection.datetime.utc,
    interval,
    yBuckets,
  ]);

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

  // Phase B — pinned, chunked data (or a single unpinned request in the fast path).
  const chunkQueries = useQueries({
    queries: chunks.map((chunk, index) => {
      const isTrailingLive = chunked && isRelative && index === 0;
      return {
        ...metricHeatmapApiOptions({
          organization,
          selection,
          traceMetric,
          query,
          interval,
          yBuckets,
          start: chunked ? chunk.start : undefined,
          end: chunked ? chunk.end : undefined,
          yMin: chunked ? boundsQuery.data?.yMin : undefined,
          yMax: chunked ? boundsQuery.data?.yMax : undefined,
          staleTime: chunked ? (isTrailingLive ? intervalMs : Infinity) : undefined,
          enabled: enabled && (chunked ? domainReady : true),
        }),
        retry: CHUNK_RETRY,
      };
    }),
  });

  // Re-merge only when a chunk's data actually changes. The signature is a
  // stable primitive that captures every chunk's status + data revision.
  const chunkSignature = chunkQueries
    .map(q => `${q.status}:${q.dataUpdatedAt}`)
    .join('|');

  const series = useMemo(() => {
    if (boundsEmpty) {
      return mergeMetricUnit(
        makeEmptyHeatMapSeries(startMs, endMs, intervalMs, yBuckets ?? 0),
        traceMetric.unit ?? undefined
      );
    }
    const succeeded = chunkQueries
      .filter(q => q.isSuccess && defined(q.data))
      .map(q => q.data!);
    if (succeeded.length === 0) {
      return;
    }
    return mergeMetricUnit(mergeHeatMapChunks(succeeded), traceMetric.unit ?? undefined);
    // chunkSignature stands in for chunkQueries' data; see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chunkSignature,
    boundsEmpty,
    startMs,
    endMs,
    intervalMs,
    yBuckets,
    traceMetric.unit,
  ]);

  const succeededCount = chunkQueries.filter(q => q.isSuccess).length;
  const erroredCount = chunkQueries.filter(q => q.isError).length;
  const loadingCount = chunkQueries.filter(
    q => q.isPending && q.fetchStatus === 'fetching'
  ).length;

  let error: Error | null = null;
  if (chunked) {
    if (boundsQuery.error) {
      error = boundsQuery.error;
    } else if (chunkQueries.length > 0 && erroredCount === chunkQueries.length) {
      error = chunkQueries.find(q => q.error)?.error ?? null;
    }
  } else {
    error = chunkQueries[0]?.error ?? null;
  }

  const isPartial = chunked && erroredCount > 0 && succeededCount > 0;
  const isFetchingMore = chunked && succeededCount > 0 && loadingCount > 0;
  const isPending = !series && !error;

  return {series, isPending, isPartial, isFetchingMore, error};
}

/**
 * Builds an empty grid used when Phase A resolves but the range has no data, so
 * the "No data" state renders instead of a perpetual spinner.
 */
function makeEmptyHeatMapSeries(
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
