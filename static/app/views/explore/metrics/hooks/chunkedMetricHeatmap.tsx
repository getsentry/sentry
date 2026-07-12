import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {getChunkedTimeRangeCombine} from 'sentry/utils/chunkedTimeRange/getChunkedTimeRangeCombine';
import {
  getChunkedTimeRangeQueries,
  type ChunkQueryOptions,
} from 'sentry/utils/chunkedTimeRange/getChunkedTimeRangeQueries';
import type {ResolvedTimeChunks} from 'sentry/utils/chunkedTimeRange/useTimeChunks';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {mergeMetricUnit} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/mergeMetricUnit';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {mergeHeatMapChunks} from 'sentry/views/explore/metrics/hooks/mergeHeatMapChunks';
import {metricHeatmapApiOptions} from 'sentry/views/explore/metrics/hooks/metricHeatmapApiOptions';
import type {HeatMapBounds} from 'sentry/views/explore/metrics/hooks/metricHeatmapBoundsApiOptions';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

interface ChunkedMetricHeatmapOptions extends ResolvedTimeChunks {
  /**
   * The pinned y-domain from Phase A. Undefined until it resolves; the queries
   * skip-token themselves off via `enabled` until then.
   */
  bounds: HeatMapBounds | undefined;
  enabled: boolean;
  organization: Organization;
  query: string;
  selection: PageFilters;
  traceMetric: TraceMetric;
  interval?: string | null;
  yBuckets?: number | null;
}

/**
 * Builds the full array of chunked heat map requests wholesale — one pinned,
 * windowed `/events-heatmap/` query per chunk — ready to spread into
 * `useQueries({queries, combine})`. Mirrors how `metricHeatmapBoundsApiOptions`
 * returns a single query; this returns the chunk array.
 *
 * Chunked requests pin the y-domain + window and run at HIGHEST_ACCURACY so every
 * chunk shares one tier; the single-chunk fast path is unpinned and keeps default
 * sampling (see `metricHeatmapApiOptions`).
 */
export function chunkedMetricHeatmapApiOptions({
  organization,
  selection,
  traceMetric,
  query,
  interval,
  yBuckets,
  bounds,
  enabled,
  chunks,
  isRelative,
  fullRange,
  intervalMs,
}: ChunkedMetricHeatmapOptions): Array<ChunkQueryOptions<HeatMapSeries>> {
  const isChunked = chunks.length > 1;
  return getChunkedTimeRangeQueries({
    chunks,
    isRelative,
    fullRange,
    intervalMs,
    buildChunkQuery: ({chunk, isTrailingLive}) =>
      metricHeatmapApiOptions({
        organization,
        selection,
        traceMetric,
        query,
        interval,
        yBuckets,
        start: isChunked ? chunk.start : undefined,
        end: isChunked ? chunk.end : undefined,
        yMin: isChunked ? bounds?.yMin : undefined,
        yMax: isChunked ? bounds?.yMax : undefined,
        sampling: isChunked ? SAMPLING_MODE.HIGH_ACCURACY : undefined,
        staleTime: isChunked ? (isTrailingLive ? intervalMs : Infinity) : undefined,
        enabled,
      }),
  });
}

/**
 * Builds the `combine` function for `useQueries` that stitches the chunk
 * responses into one dense, unit-patched grid. Wrap this in `useMemo` (keyed on
 * the resolved chunks + unit) so the returned function stays referentially
 * stable — see `getChunkedTimeRangeCombine`.
 */
export function metricHeatmapCombine({
  chunks,
  isRelative,
  fullRange,
  intervalMs,
  unit,
}: ResolvedTimeChunks & {unit: TraceMetric['unit']}) {
  const metricUnit = unit ?? undefined;
  return getChunkedTimeRangeCombine({
    chunks,
    isRelative,
    fullRange,
    intervalMs,
    merge: (responses: HeatMapSeries[], context) => {
      // Fast path: the single unpinned response is already a dense, ordered grid.
      // Chunked: stitch the chunks into one dense, full-range grid.
      const merged =
        context.chunks.length > 1
          ? mergeHeatMapChunks(responses, {
              xStart: context.fullRange.start,
              xEnd: context.fullRange.end,
              intervalMs: context.intervalMs,
            })
          : responses[0]!;
      return mergeMetricUnit(merged, metricUnit);
    },
  });
}

/**
 * An empty, unit-patched grid for when Phase A resolves but the range has no
 * data, so the "No data" state renders instead of a perpetual spinner.
 */
export function emptyHeatMapSeries(
  startMs: number,
  endMs: number,
  intervalMs: number,
  yBuckets: number,
  unit: TraceMetric['unit']
): HeatMapSeries {
  return mergeMetricUnit(
    {
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
    },
    unit ?? undefined
  );
}
