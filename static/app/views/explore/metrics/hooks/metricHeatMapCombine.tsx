import type {UseQueryResult} from '@tanstack/react-query';

import {defined} from 'sentry/utils/defined';
import type {
  HeatMapItem,
  HeatMapSeries,
} from 'sentry/views/dashboards/widgets/common/types';
import type {TimeDomain} from 'sentry/views/explore/metrics/hooks/partitionHeatMapWindows';

export interface ChunkedHeatMapResult {
  error: Error | null;
  isFetching: boolean;
  /**
   * A chunk failed but others succeeded.
   */
  isPartial: boolean;
  isPending: boolean;
  /**
   * The merged grid, present once one chunk resolves.
   */
  series: HeatMapSeries | undefined;
}

/**
 * Builds a `combine` function for `useQueries` that stitches heat map chunk
 * responses into one grid and derives the streaming/partial state.
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
    const anyLoading = results.some(q => q.isPending && q.isFetching);
    const allErrored = results.length > 0 && results.every(q => q.isError);

    let series: HeatMapSeries | undefined;
    if (anySuccess) {
      // If there was only one window, we don't need to merge anything, just
      // return the data.
      series =
        results.length === 1
          ? succeeded[0]
          : mergeHeatMapChunks(succeeded, timeDomain, intervalMs);
    }

    return {
      series,
      error: allErrored ? (results.find(q => q.error)?.error ?? null) : null,
      isPending: results.some(result => result.isPending),
      isFetching: results.some(result => result.isFetching),
      isPartial: anySuccess && anyError && !anyLoading,
    };
  };
}

/**
 * Merges several windows of heat map responses into one `HeatMapSeries`
 * spanning `timeDomain`.
 */
export function mergeHeatMapChunks(
  chunks: HeatMapSeries[],
  timeDomain: TimeDomain,
  intervalMs: number
): HeatMapSeries {
  if (chunks.length === 0) {
    throw new Error('mergeHeatMapChunks requires at least one chunk');
  }

  // Track and extract all known values by the X and Y axis coordinates.
  const loaded = new Map<string, number>();

  // Keep track of known Y-axis values, so we can fill the final grid.
  const yValueSet = new Set<number>();

  // The oldest and newest bucket any chunk covers, used to size the grid.
  let minLoadedX = Infinity;
  let maxLoadedX = -Infinity;

  for (const chunk of chunks) {
    minLoadedX = Math.min(minLoadedX, chunk.meta.xAxis.start);
    maxLoadedX = Math.max(maxLoadedX, chunk.meta.xAxis.end);

    for (const {xAxis, yAxis, zAxis} of chunk.values) {
      yValueSet.add(yAxis);

      if (zAxis === null) {
        continue;
      }

      const key = `${xAxis}|${yAxis}`;

      // If there is more than one values (i.e., different chunks covered the
      // same coordinates) take the _higher_ value. This works well for
      // `count()` since a higher value implies that the bucket is more
      // complete.
      const prev = loaded.get(key);
      loaded.set(key, prev === undefined ? zAxis : Math.max(prev, zAxis));
    }
  }

  const yValues = Array.from(yValueSet).sort((a, b) => a - b);

  // The grid ends at the newest loaded bucket — extending past the planned end
  // for a relative live edge — and is at least the planned `width` wide. Its
  // start is the planned offset, but never later than the oldest loaded bucket,
  // so a later-arriving older chunk isn't trimmed off the left by the slide.
  const width = timeDomain.end - timeDomain.start;
  const gridEnd = Math.max(timeDomain.end, maxLoadedX + intervalMs);
  const gridStart = Math.min(gridEnd - width, minLoadedX);

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
