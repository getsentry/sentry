import {useCallback, useMemo} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {
  getChunkedTimeRangeQueries,
  type ChunkQueryContext,
} from 'sentry/utils/chunkedTimeRange/getChunkedTimeRangeQueries';
import {
  useChunkedTimeRangeResults,
  type ChunkMergeContext,
} from 'sentry/utils/chunkedTimeRange/useChunkedTimeRangeResults';
import {useTimeChunks} from 'sentry/utils/chunkedTimeRange/useTimeChunks';
import {defined} from 'sentry/utils/defined';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {mergeMetricUnit} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/mergeMetricUnit';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
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

/**
 * Heat map data source for Explore and Dashboards, built on the generic
 * chunked-time-range machinery in `sentry/utils/chunkedTimeRange`.
 *
 * Wide ranges are fetched in two phases. Phase A learns the global y-domain with
 * one cheap `min`/`max` aggregate. Phase B builds one epoch-aligned, pinned
 * request per chunk (`getChunkedTimeRangeQueries` + our `buildChunkQuery`), fires
 * them with `useQueries`, and stitches the results into one dense grid
 * (`useChunkedTimeRangeResults` + our `mergeHeatMapChunks`). A failed chunk
 * degrades to a partial render.
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
  const validDims = defined(yBuckets) && yBuckets > 0;
  const resolved = useTimeChunks({selection, interval: validDims ? interval : null});
  const {chunked, fullRange, intervalMs} = resolved;

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

  const chunkEnabled = enabled && validDims && (chunked ? domainReady : true);

  // Phase B request builder: pins the chunk to the domain and windows it. The
  // fast (single-chunk) path uses the selection range and no pin.
  const buildChunkQuery = ({
    chunk,
    chunked: isChunked,
    isTrailingLive,
  }: ChunkQueryContext) =>
    metricHeatmapApiOptions({
      organization,
      selection,
      traceMetric,
      query,
      interval,
      yBuckets,
      start: isChunked ? chunk.start : undefined,
      end: isChunked ? chunk.end : undefined,
      yMin: isChunked ? boundsQuery.data?.yMin : undefined,
      yMax: isChunked ? boundsQuery.data?.yMax : undefined,
      // Pin every chunk to TIER_1 so they share one sampling tier; the fast path
      // keeps default sampling. See metricHeatmapApiOptions for why.
      sampling: isChunked ? SAMPLING_MODE.HIGH_ACCURACY : undefined,
      staleTime: isChunked ? (isTrailingLive ? intervalMs : Infinity) : undefined,
      enabled: chunkEnabled,
    });

  const metricUnit = traceMetric.unit ?? undefined;
  const merge = useCallback(
    (responses: HeatMapSeries[], context: ChunkMergeContext) => {
      // Fast path: the single unpinned response is already a dense, ordered grid.
      // Chunked: stitch the chunks into one dense, full-range grid.
      const merged = context.chunked
        ? mergeHeatMapChunks(responses, {
            xStart: context.fullRange.start,
            xEnd: context.fullRange.end,
            intervalMs: context.intervalMs,
          })
        : responses[0]!;
      return mergeMetricUnit(merged, metricUnit);
    },
    [metricUnit]
  );

  // Build one apiOptions per chunk, fire them, then stitch the results. We own
  // the `useQueries` call (per Sentry's abstract-over-apiOptions convention).
  const queries = getChunkedTimeRangeQueries({...resolved, buildChunkQuery});
  const results = useQueries({queries});
  const {
    data,
    isPartial,
    isFetchingMore,
    error: chunkError,
  } = useChunkedTimeRangeResults({...resolved, results, merge});

  // Phase A resolved but the range has no data: render an empty grid so the
  // "No data" state shows instead of a perpetual spinner.
  const emptySeries = useMemo(
    () =>
      mergeMetricUnit(
        makeEmptyHeatMapSeries(fullRange.start, fullRange.end, intervalMs, yBuckets ?? 0),
        metricUnit
      ),
    [fullRange.start, fullRange.end, intervalMs, yBuckets, metricUnit]
  );

  const series = boundsEmpty ? emptySeries : data;
  const error = boundsQuery.error ?? chunkError;

  return {
    series,
    error,
    isPartial,
    isFetchingMore,
    isPending: !series && !error,
  };
}

/**
 * Builds an empty grid used when Phase A resolves but the range has no data.
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
