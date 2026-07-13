import type {UseQueryResult} from '@tanstack/react-query';

import {defined} from 'sentry/utils/defined';
import type {
  HeatMapItem,
  HeatMapSeries,
} from 'sentry/views/dashboards/widgets/common/types';
import type {TimeDomain} from 'sentry/views/explore/metrics/hooks/partitionHeatMapWindows';

export interface ChunkedHeatMapResult {
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
 * responses into one dense grid and derives the streaming/partial state. Named to
 * mirror `partitionDateTimeIntoHeatMapWindows` — it's the other half.
 *
 * Wrap this in `useMemo` (keyed on the plan) so the returned function stays
 * referentially stable: query-core re-runs `combine` only when the results change
 * or the `combine` reference changes (and `replaceEqualDeep`s the output), so an
 * unstable combine would rebuild the (expensive) merge every render.
 */
export function makePartitionedHeatMapWindowCombiner({
  timeDomain,
  intervalMs,
}: {
  intervalMs: number;
  timeDomain: TimeDomain;
}) {
  return (results: Array<UseQueryResult<HeatMapSeries>>): ChunkedHeatMapResult => {
    const succeeded = results
      .filter(q => q.isSuccess && defined(q.data))
      .map(q => q.data!);
    const anySuccess = succeeded.length > 0;
    const anyError = results.some(q => q.isError);
    const anyLoading = results.some(q => q.isPending && q.fetchStatus === 'fetching');
    const allErrored = results.length > 0 && results.every(q => q.isError);

    let series: HeatMapSeries | undefined;
    if (anySuccess) {
      // A single window is the fast path — its response is already a dense grid
      // over the whole selection, so use it as-is. Only combine knows this is the
      // fast path (one window total) vs. one chunk of many still streaming, which
      // must be placed in its slice — so the decision lives here, not in the merge.
      series =
        results.length === 1
          ? succeeded[0]
          : mergeHeatMapChunks(succeeded, timeDomain, intervalMs);
    }

    return {
      series,
      error: allErrored ? (results.find(q => q.error)?.error ?? null) : null,
      // Some chunks failed but others rendered — a settled grid with a gap.
      isPartial: anySuccess && anyError && !anyLoading,
      // The grid is painting progressively — some rendered, more still loading.
      isFetchingMore: anySuccess && anyLoading,
    };
  };
}

/**
 * Merges several pinned heat map chunk responses into one dense `HeatMapSeries`
 * spanning `timeDomain`.
 *
 * Every cell is indexed by `[x, y]`, taking the MAX `z` where chunks overlap.
 * Absolute chunks don't overlap (aligned seams split cleanly between buckets), so
 * max is a no-op. Relative chunks DO overlap: the backend's row filter bisects an
 * unaligned seam bucket, so each side holds a partial copy — but the overlap
 * guarantees the complete copy exists in one chunk, and since `z` is `count()` the
 * complete count is the larger one, so max picks it. See `partitionDateTimeIntoHeatMapWindows`.
 *
 * Why max and not "just take the older chunk"? Each chunk has a partial bucket at
 * its OWN unaligned edge, and across an overlap those edges sit at opposite ends —
 * so neither "always older" nor "always newer" is right. For the overlap between a
 * newer window `[now-6h, now]` and an older `[now-24h, now-4h]` (`B = floor(now)`):
 *
 *   bucket          newer chunk        older chunk
 *   [B-6h, B-5h)    partial (starts)   complete
 *   [B-5h, B-4h)    complete           complete
 *   [B-4h, B-3h)    complete           partial (ends)
 *
 * "Take older" undercounts `[B-4h, B-3h)`; "take newer" undercounts `[B-6h, B-5h)`.
 * Max grabs the complete (larger) copy at both ends without tracking which is which.
 *
 * Callers must pass only *succeeded* chunks (at least one).
 */
export function mergeHeatMapChunks(
  chunks: HeatMapSeries[],
  timeDomain: TimeDomain,
  intervalMs: number
): HeatMapSeries {
  if (chunks.length === 0) {
    // Unreachable: the combiner only merges when ≥1 chunk succeeded. A clear
    // throw beats the obscure crash the meta reads below would otherwise cause.
    throw new Error('mergeHeatMapChunks requires at least one chunk');
  }

  // Index loaded cells by "x|y", keeping the max z across overlapping chunks. The
  // coords are numbers and `|` never appears in one, so distinct cells never
  // collide (no risk from the number→string coercion).
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
      // First copy of this cell wins outright; a second (overlap) copy keeps the
      // larger count — the complete bucket over its partial twin.
      const key = `${xAxis}|${yAxis}`;
      const prev = loaded.get(key);
      loaded.set(key, prev === undefined ? zAxis : Math.max(prev, zAxis));
    }
  }
  const yValues = Array.from(yValueSet).sort((a, b) => a - b);

  // The grid is a fixed-width window (the domain's width) that ends at the newest
  // loaded bucket. For an absolute range the planned end always wins (its data
  // never exceeds it), so the grid == the domain. For a relative range the newest
  // loaded bucket advances past the (frozen) planned end as time passes, so the
  // window slides forward — the live edge shows — and the start slides with it to
  // keep the width.
  const width = timeDomain.end - timeDomain.start;
  const gridEnd = Math.max(timeDomain.end, maxLoadedX + intervalMs);
  const gridStart = gridEnd - width;

  // Emit a dense grid, column-major (x outer, y inner) ascending — the shape the
  // heat map renders. Each cell is the loaded z or a `null` placeholder for a
  // bucket no chunk has covered yet (so a partial load occupies its true slice
  // instead of stretching to fill). Track the z-range over the populated cells so
  // the color scale reflects everything rendered so far.
  const values: HeatMapItem[] = [];
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
