import type {UseQueryResult} from '@tanstack/react-query';

import {defined} from 'sentry/utils/defined';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {MetricHeatmapPlan} from 'sentry/views/explore/metrics/hooks/chunkedMetricHeatmap';

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
  isChunked,
  fullRange,
  intervalMs,
}: Pick<MetricHeatmapPlan, 'fullRange' | 'intervalMs'> & {
  isChunked: boolean;
}) {
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
      series = isChunked
        ? mergeHeatMapChunks(succeeded, {
            xStart: fullRange.start,
            xEnd: fullRange.end,
            intervalMs,
          })
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
 * Each chunk response is already a well-formed grid — dense over its own window
 * and ordered x-major / y-minor ascending (the same shape a single request
 * returns). The chunks tile the range contiguously without overlap, so we just
 * lay them side by side in x order and concatenate their `values`. The only
 * synthesized cells are empty (`zAxis: null`) columns for windows that haven't
 * loaded yet — without them a partially-loaded set of columns would stretch to
 * fill the whole chart instead of occupying its true horizontal slice.
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

  const {xStart, xEnd, intervalMs} = grid;

  // Lay chunks out left-to-right; each is dense within its own window.
  const ordered = [...chunks].sort((a, b) => columnStart(a) - columnStart(b));
  const first = ordered[0]!;

  // The pinned y bucket lower-bounds are identical across chunks, so any chunk's
  // y values are the full set — reused to synthesize empty columns for gaps.
  const yValues = Array.from(new Set(first.values.map(value => value.yAxis))).sort(
    (a, b) => a - b
  );
  const emptyColumn = (x: number): HeatMapValue[] =>
    yValues.map(y => ({xAxis: x, yAxis: y, zAxis: null}));

  const values: HeatMapValue[] = [];
  let x = xStart;
  for (const chunk of ordered) {
    // Pad the gap before this chunk with empty columns.
    for (; x < columnStart(chunk); x += intervalMs) {
      values.push(...emptyColumn(x));
    }
    values.push(...chunk.values);
    x = columnEnd(chunk) + intervalMs;
  }
  // Pad any trailing gap after the last loaded chunk.
  for (; x < xEnd; x += intervalMs) {
    values.push(...emptyColumn(x));
  }

  // Recompute the z range across the merged cells so the color scale reflects
  // everything rendered so far.
  let zStart: number | null = null;
  let zEnd: number | null = null;
  for (const value of values) {
    if (value.zAxis !== null) {
      zStart = zStart === null ? value.zAxis : Math.min(zStart, value.zAxis);
      zEnd = zEnd === null ? value.zAxis : Math.max(zEnd, value.zAxis);
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

// A chunk's x-range from its own (dense, ascending) cells — robust to whatever
// its meta reports.
const columnStart = (chunk: HeatMapSeries) =>
  Math.min(...chunk.values.map(value => value.xAxis));
const columnEnd = (chunk: HeatMapSeries) =>
  Math.max(...chunk.values.map(value => value.xAxis));
