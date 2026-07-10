import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';

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
