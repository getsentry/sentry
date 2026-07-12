import {skipToken} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getChunkedTimeRangeCombine} from 'sentry/utils/chunkedTimeRange/getChunkedTimeRangeCombine';
import {
  getChunkedTimeRangeQueries,
  type ChunkQueryOptions,
} from 'sentry/utils/chunkedTimeRange/getChunkedTimeRangeQueries';
import type {ResolvedTimeChunks} from 'sentry/utils/chunkedTimeRange/useTimeChunks';
import {getUtcDateString} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {mergeMetricUnit} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/mergeMetricUnit';
import {
  SAMPLING_MODE,
  type SamplingMode,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {HeatMapBounds} from 'sentry/views/explore/metrics/hooks/metricHeatmapBoundsApiOptions';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createTraceMetricEventsFilter} from 'sentry/views/explore/metrics/utils';

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

interface MetricHeatmapApiOptions {
  enabled: boolean;
  organization: Organization;
  query: string;
  selection: PageFilters;
  traceMetric: TraceMetric;
  /**
   * Chunk end override (ms). When provided (with `start`), the request covers
   * this concrete window instead of the page-filter range, and `statsPeriod` is
   * omitted. Used for chunked (Phase B) fetching.
   */
  end?: number;
  interval?: string | null;
  /**
   * EAP sampling mode. Chunked (Phase B) requests pass HIGHEST_ACCURACY so every
   * chunk runs on the same undownsampled tier (TIER_1); see the docstring below.
   * The unchunked fast path leaves this undefined (default sampling), matching
   * the pre-chunking behavior.
   */
  sampling?: SamplingMode;
  /**
   * Overrides the default `staleTime`. Chunked fetching sets immutable historical
   * chunks to `Infinity` and only the trailing (live) chunk to the interval.
   */
  staleTime?: number;
  /**
   * Chunk start override (ms). See `end`.
   */
  start?: number;
  yBuckets?: number | null;
  /**
   * Pins the upper y-axis bound so parallel chunks share identical buckets.
   */
  yMax?: number;
  /**
   * Pins the lower y-axis bound so parallel chunks share identical buckets.
   */
  yMin?: number;
}

/**
 * Builds one `/events-heatmap/` request — either the whole selection (fast path)
 * or a single pinned, windowed chunk (Phase B).
 *
 * Chunked callers pass `sampling: HIGHEST_ACCURACY`. EAP picks a downsampling
 * tier per request from the query's time range + estimated row count, so
 * differently-sized chunks could otherwise land on different tiers — making the
 * extrapolated `count()` values noisy/non-uniform across the grid (visible
 * brightness seams between chunks) and potentially inconsistent with the pinned
 * bounds. Forcing TIER_1 keeps every chunk exact and uniform. The speedup comes
 * from smaller parallel windows, not downsampling — so if a chunk is too slow,
 * shrink the chunks (the `computeTimeChunks` policy), do NOT re-enable per-chunk
 * downsampling. See the backend-contract note in `getChunkedTimeRangeQueries`.
 */
function metricHeatmapApiOptions({
  organization,
  selection,
  traceMetric,
  query,
  enabled,
  interval,
  yBuckets,
  yMin,
  yMax,
  sampling,
  start: startOverride,
  end: endOverride,
  staleTime: staleTimeOverride,
}: MetricHeatmapApiOptions) {
  const traceMetricFilter = createTraceMetricEventsFilter([traceMetric]);
  const combinedQuery = query ? `${traceMetricFilter} (${query})` : traceMetricFilter;

  const intervalInMilliseconds = defined(interval) ? intervalToMilliseconds(interval) : 0;
  const valid =
    defined(interval) && defined(yBuckets) && yBuckets > 0 && intervalInMilliseconds > 0;

  // A concrete chunk window takes precedence over the page-filter range. When
  // used, `statsPeriod` is dropped so the two don't fight.
  const usesChunkWindow = defined(startOverride) && defined(endOverride);

  const normalized = normalizeDateTimeParams(selection.datetime);
  const start = usesChunkWindow ? getUtcDateString(startOverride) : normalized.start;
  const end = usesChunkWindow ? getUtcDateString(endOverride) : normalized.end;
  const statsPeriod = usesChunkWindow ? undefined : normalized.statsPeriod;

  const usesRelativeDateRange = !defined(start) && !defined(end) && defined(statsPeriod);

  const defaultStaleTime =
    usesRelativeDateRange && intervalInMilliseconds !== 0
      ? intervalInMilliseconds
      : Infinity;

  return apiOptions.as<HeatMapSeries>()(
    '/organizations/$organizationIdOrSlug/events-heatmap/',
    {
      path: !enabled || !valid ? skipToken : {organizationIdOrSlug: organization.slug},
      query: {
        dataset: DiscoverDatasets.TRACEMETRICS,
        xAxis: 'time',
        yAxis: 'value',
        zAxis: 'count()',
        yBuckets,
        interval,
        yMin,
        yMax,
        sampling,
        query: combinedQuery,
        project: selection.projects,
        environment: selection.environments,
        start,
        end,
        statsPeriod,
        referrer: 'api.explore.tracemetrics-heatmap',
      },
      staleTime: staleTimeOverride ?? defaultStaleTime,
    }
  );
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

type HeatMapValue = HeatMapSeries['values'][number];

interface HeatMapGrid {
  /**
   * X bucket width in ms (the shared interval).
   */
  intervalMs: number;
  /**
   * Exclusive end of the full x range, in ms.
   */
  xEnd: number;
  /**
   * Start of the full x range, in ms.
   */
  xStart: number;
}

/**
 * Merges the responses of several pinned, epoch-aligned heat map chunks into one
 * dense `HeatMapSeries` covering the whole `grid` range.
 *
 * The heat map positions cells on a category axis whose categories are inferred
 * from the order values appear in the data, and it sizes the grid by how many
 * columns are present. So the merged series must:
 *  - be ordered x-major / y-minor ascending (matching a single-request response),
 *    otherwise chunks render out of order with seams at the boundaries, and
 *  - always span the full x range with a cell per column, otherwise a
 *    partially-loaded set of columns stretches to fill the whole chart.
 *
 * Columns that haven't loaded yet are emitted as empty (`zAxis: null`) cells, so
 * loaded chunks occupy their correct horizontal slice and the rest fills in as
 * chunks resolve. Every chunk shares the same pinned y-domain, so the y buckets
 * come straight from any loaded chunk.
 *
 * Callers must pass only *succeeded* chunks (at least one).
 */
export function mergeHeatMapChunks(
  chunks: HeatMapSeries[],
  grid: HeatMapGrid
): HeatMapSeries {
  if (chunks.length === 0) {
    throw new Error('mergeHeatMapChunks requires at least one chunk');
  }

  const first = chunks[0]!;
  const {xStart, xEnd, intervalMs} = grid;

  // The pinned y bucket lower-bounds are identical across chunks, so any chunk's
  // y values are the full set.
  const yValues = Array.from(new Set(first.values.map(value => value.yAxis))).sort(
    (a, b) => a - b
  );

  // Index every loaded cell by [x,y] and track the z range across the merged set
  // so the color scale reflects everything rendered so far.
  const loaded = new Map<string, HeatMapValue>();
  let zStart: number | null = null;
  let zEnd: number | null = null;
  for (const chunk of chunks) {
    for (const value of chunk.values) {
      loaded.set(`${value.xAxis}|${value.yAxis}`, value);
      if (value.zAxis !== null) {
        zStart = zStart === null ? value.zAxis : Math.min(zStart, value.zAxis);
        zEnd = zEnd === null ? value.zAxis : Math.max(zEnd, value.zAxis);
      }
    }
  }

  const values: HeatMapValue[] = [];
  for (let x = xStart; x < xEnd; x += intervalMs) {
    for (const y of yValues) {
      values.push(loaded.get(`${x}|${y}`) ?? {xAxis: x, yAxis: y, zAxis: null});
    }
  }

  return {
    values,
    meta: {
      xAxis: {
        ...first.meta.xAxis,
        start: xStart,
        end: xEnd,
        bucketCount: Math.round((xEnd - xStart) / intervalMs),
        bucketSize: intervalMs / 1000,
      },
      // The y-axis is identical across pinned chunks; take it wholesale.
      yAxis: first.meta.yAxis,
      zAxis: {
        ...first.meta.zAxis,
        start: zStart ?? 0,
        end: zEnd ?? 0,
      },
    },
  };
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
