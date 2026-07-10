import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';

/**
 * Merges the responses of several pinned, epoch-aligned heat map chunks into a
 * single `HeatMapSeries`.
 *
 * Every chunk was fetched with the same pinned y-domain (`yMin`/`yMax`),
 * `yBuckets`, and `interval`, so their y-coordinates are identical and their
 * x-coordinates are epoch-aligned and non-overlapping. That makes the merge a
 * plain concatenation of `values`; only the x-axis span and the z-axis color
 * range need recomputing across the merged set.
 *
 * Callers must pass only *succeeded* chunks. The first chunk supplies the shared
 * meta (axis names, y-domain, units) that pinning guarantees is identical.
 */
export function mergeHeatMapChunks(chunks: HeatMapSeries[]): HeatMapSeries {
  if (chunks.length === 0) {
    throw new Error('mergeHeatMapChunks requires at least one chunk');
  }

  const first = chunks[0]!;
  const values = chunks.flatMap(chunk => chunk.values);

  if (process.env.NODE_ENV !== 'production') {
    const seen = new Set<string>();
    for (const value of values) {
      const key = `${value.xAxis},${value.yAxis}`;
      if (seen.has(key)) {
        // eslint-disable-next-line no-console
        console.error(
          `mergeHeatMapChunks: duplicate cell at [${key}] — chunk seams are misaligned`
        );
      }
      seen.add(key);
    }
  }

  let xStart = first.meta.xAxis.start;
  let xEnd = first.meta.xAxis.end;
  let xBucketCount = 0;
  for (const chunk of chunks) {
    xStart = Math.min(xStart, chunk.meta.xAxis.start);
    xEnd = Math.max(xEnd, chunk.meta.xAxis.end);
    xBucketCount += chunk.meta.xAxis.bucketCount;
  }

  // Recompute the color scale bounds from everything rendered so far, so the
  // palette reflects the merged grid rather than a single chunk.
  let zStart: number | null = null;
  let zEnd: number | null = null;
  for (const value of values) {
    if (value.zAxis === null) {
      continue;
    }
    zStart = zStart === null ? value.zAxis : Math.min(zStart, value.zAxis);
    zEnd = zEnd === null ? value.zAxis : Math.max(zEnd, value.zAxis);
  }

  return {
    values,
    meta: {
      xAxis: {
        ...first.meta.xAxis,
        start: xStart,
        end: xEnd,
        bucketCount: xBucketCount,
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
