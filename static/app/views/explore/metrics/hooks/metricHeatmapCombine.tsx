import type {UseQueryResult} from '@tanstack/react-query';

import {defined} from 'sentry/utils/defined';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {mergeMetricUnit} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/mergeMetricUnit';
import type {MetricHeatmapPlan} from 'sentry/views/explore/metrics/hooks/chunkedMetricHeatmap';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

export interface ChunkedHeatmapResult {
  /**
   * A fatal error — every chunk failed. Partial failures do not set this.
   */
  error: Error | null;
  /**
   * At least one chunk is still loading while others have resolved.
   */
  isFetchingMore: boolean;
  /**
   * A chunk failed but others succeeded.
   */
  isPartial: boolean;
  /**
   * The merged, unit-patched grid, present once one chunk resolves.
   */
  series: HeatMapSeries | undefined;
}

/**
 * Builds the `combine` function for `useQueries` that stitches the chunk
 * responses into one dense, unit-patched grid and derives the streaming/partial
 * state.
 *
 * Wrap this in `useMemo` (keyed on the plan + unit) so the returned function
 * stays referentially stable: query-core re-runs `combine` only when the results
 * change or the `combine` reference changes (and `replaceEqualDeep`s the output),
 * so an unstable combine would rebuild the (expensive) merge every render.
 */
export function metricHeatmapCombine({
  isChunked,
  fullRange,
  intervalMs,
  unit,
}: Pick<MetricHeatmapPlan, 'fullRange' | 'intervalMs'> & {
  isChunked: boolean;
  unit: TraceMetric['unit'];
}) {
  const metricUnit = unit ?? undefined;

  return (results: Array<UseQueryResult<HeatMapSeries>>): ChunkedHeatmapResult => {
    const succeeded = results
      .filter(q => q.isSuccess && defined(q.data))
      .map(q => q.data!);
    const succeededCount = results.filter(q => q.isSuccess).length;
    const erroredCount = results.filter(q => q.isError).length;
    const loadingCount = results.filter(
      q => q.isPending && q.fetchStatus === 'fetching'
    ).length;

    const allErrored = results.length > 0 && erroredCount === results.length;
    const error = allErrored ? (results.find(q => q.error)?.error ?? null) : null;

    let series: HeatMapSeries | undefined;
    if (succeeded.length > 0) {
      // Fast path: the single unpinned response is already a dense, ordered grid.
      // Chunked: stitch the chunks into one dense, full-range grid.
      const merged = isChunked
        ? mergeHeatMapChunks(succeeded, {
            xStart: fullRange.start,
            xEnd: fullRange.end,
            intervalMs,
          })
        : succeeded[0]!;
      series = mergeMetricUnit(merged, metricUnit);
    }

    return {
      series,
      error,
      isPartial: isChunked && erroredCount > 0 && succeededCount > 0,
      isFetchingMore: isChunked && succeededCount > 0 && loadingCount > 0,
    };
  };
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
