import type {UseQueryResult} from '@tanstack/react-query';

import {defined} from 'sentry/utils/defined';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {MetricHeatmapPlan} from 'sentry/views/explore/metrics/hooks/partitionHeatmapWindows';

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
   * The merged grid, present once one chunk resolves. The metric unit is patched
   * on later by the caller — that's not the combiner's concern.
   */
  series: HeatMapSeries | undefined;
}

/**
 * Builds the `combine` function for `useQueries` that stitches the chunk
 * responses into one dense grid and derives the streaming/partial state.
 *
 * Wrap this in `useMemo` (keyed on the plan) so the returned function stays
 * referentially stable: query-core re-runs `combine` only when the results change
 * or the `combine` reference changes (and `replaceEqualDeep`s the output), so an
 * unstable combine would rebuild the (expensive) merge every render.
 */
export function metricHeatmapCombine({
  fullRange,
  intervalMs,
}: Pick<MetricHeatmapPlan, 'fullRange' | 'intervalMs'>) {
  return (results: Array<UseQueryResult<HeatMapSeries>>): ChunkedHeatmapResult => {
    // One query per window, so >1 result means we chunked.
    const isChunked = results.length > 1;
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
      series = isChunked
        ? mergeHeatMapChunks(succeeded, {range: fullRange, intervalMs})
        : succeeded[0]!;
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
   * The planned x range in ms, interval-aligned (bounds are epoch multiples of
   * `intervalMs`). It sets the grid WIDTH; the grid slides to end at the newest
   * loaded bucket so a relative range's live edge shows past this (frozen) end.
   */
  range: {end: number; start: number};
}

/**
 * Merges several pinned heat map chunk responses into one dense `HeatMapSeries`.
 *
 * Every cell is indexed by `[x, y]`, taking the MAX `z` where chunks overlap.
 * Absolute chunks don't overlap (aligned seams split cleanly between buckets), so
 * max is a no-op. Relative chunks DO overlap: the backend's row filter bisects an
 * unaligned seam bucket, so each side holds a partial copy — but the overlap
 * guarantees the complete copy exists in one chunk, and since `z` is `count()` the
 * complete count is the larger one, so max picks it. See `partitionHeatmapWindows`.
 *
 * The grid is dense over its full width, with empty (`zAxis: null`) cells for
 * columns no chunk has loaded yet, so a partial load occupies its true slice
 * instead of stretching to fill the chart.
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

  const {range, intervalMs} = grid;

  // Index loaded cells by [x,y], keeping the max z across overlapping chunks.
  const loaded = new Map<string, number>();
  const yValueSet = new Set<number>();
  let maxLoadedX = -Infinity;
  for (const chunk of chunks) {
    for (const {xAxis, yAxis, zAxis} of chunk.values) {
      yValueSet.add(yAxis);
      maxLoadedX = Math.max(maxLoadedX, xAxis);
      if (zAxis === null) {
        continue;
      }
      const key = `${xAxis}|${yAxis}`;
      const prev = loaded.get(key);
      loaded.set(key, prev === undefined ? zAxis : Math.max(prev, zAxis));
    }
  }
  const yValues = Array.from(yValueSet).sort((a, b) => a - b);

  // Fixed-width window ending at the newest loaded bucket: a relative range's live
  // edge advances past the frozen planned end, while an absolute range's planned
  // end always wins (its data never exceeds it). Start slides to keep the width.
  const width = range.end - range.start;
  const gridEnd = Math.max(range.end, maxLoadedX + intervalMs);
  const gridStart = gridEnd - width;

  const values: HeatMapValue[] = [];
  let zStart: number | null = null;
  let zEnd: number | null = null;
  for (let x = gridStart; x < gridEnd; x += intervalMs) {
    for (const y of yValues) {
      const zAxis = loaded.get(`${x}|${y}`) ?? null;
      values.push({xAxis: x, yAxis: y, zAxis});
      if (zAxis !== null) {
        zStart = zStart === null ? zAxis : Math.min(zStart, zAxis);
        zEnd = zEnd === null ? zAxis : Math.max(zEnd, zAxis);
      }
    }
  }

  // All chunks share the pinned y-domain + axis names, so take meta from any.
  const first = chunks[0]!;
  return {
    values,
    meta: {
      xAxis: {
        ...first.meta.xAxis,
        start: gridStart,
        end: gridEnd,
        bucketCount: Math.round((gridEnd - gridStart) / intervalMs),
        bucketSize: intervalMs / 1000,
      },
      yAxis: first.meta.yAxis,
      zAxis: {
        ...first.meta.zAxis,
        start: zStart ?? 0,
        end: zEnd ?? 0,
      },
    },
  };
}
