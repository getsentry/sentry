import type {UseQueryResult} from '@tanstack/react-query';

import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {
  mergeHeatMapChunks,
  metricHeatmapCombine,
} from 'sentry/views/explore/metrics/hooks/chunkedMetricHeatmap';

const HOUR = 60 * 60 * 1000;

// Two pinned y buckets shared by every chunk.
const Y_VALUES = [0, 50];

function makeChunk(columns: Array<{x: number; z: [number, number]}>): HeatMapSeries {
  const values = columns.flatMap(({x, z}) =>
    Y_VALUES.map((y, i) => ({xAxis: x, yAxis: y, zAxis: z[i]!}))
  );
  return {
    values,
    meta: {
      xAxis: {name: 'time', start: 0, end: 0, bucketCount: 0, bucketSize: 3600},
      yAxis: {
        name: 'value',
        start: 0,
        end: 100,
        bucketCount: 2,
        bucketSize: 50,
        valueType: 'number',
        valueUnit: null,
      },
      zAxis: {name: 'count()', start: 0, end: 0},
    },
  };
}

describe('mergeHeatMapChunks', () => {
  const grid = {xStart: 0, xEnd: 3 * HOUR, intervalMs: HOUR};

  it('throws when given no chunks', () => {
    expect(() => mergeHeatMapChunks([], grid)).toThrow();
  });

  it('builds a dense, full-range grid ordered x-major then y-minor', () => {
    // Only the first two columns are loaded; the third is missing.
    const chunk = makeChunk([
      {x: 0, z: [1, 2]},
      {x: HOUR, z: [3, 4]},
    ]);

    const merged = mergeHeatMapChunks([chunk], grid);

    // 3 columns x 2 y buckets, no matter that only 2 columns loaded.
    expect(merged.values).toHaveLength(6);
    expect(merged.values.map(v => [v.xAxis, v.yAxis])).toEqual([
      [0, 0],
      [0, 50],
      [HOUR, 0],
      [HOUR, 50],
      [2 * HOUR, 0],
      [2 * HOUR, 50],
    ]);
    // The unloaded column is emitted as empty cells.
    expect(merged.values.slice(4)).toEqual([
      {xAxis: 2 * HOUR, yAxis: 0, zAxis: null},
      {xAxis: 2 * HOUR, yAxis: 50, zAxis: null},
    ]);
    expect(merged.meta.xAxis.start).toBe(0);
    expect(merged.meta.xAxis.end).toBe(3 * HOUR);
    expect(merged.meta.xAxis.bucketCount).toBe(3);
  });

  it('orders columns ascending even when chunks are passed newest-first', () => {
    const newer = makeChunk([{x: 2 * HOUR, z: [5, 6]}]);
    const older = makeChunk([{x: 0, z: [1, 2]}]);

    const merged = mergeHeatMapChunks([newer, older], grid);

    const xs = merged.values.map(v => v.xAxis);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    // The loaded cells keep their values at the right coordinates.
    expect(merged.values.find(v => v.xAxis === 0 && v.yAxis === 0)?.zAxis).toBe(1);
    expect(merged.values.find(v => v.xAxis === 2 * HOUR && v.yAxis === 50)?.zAxis).toBe(
      6
    );
  });

  it('takes the y-domain from a chunk and recomputes the z-range over loaded cells', () => {
    const merged = mergeHeatMapChunks(
      [makeChunk([{x: 0, z: [4, 9]}]), makeChunk([{x: HOUR, z: [2, 7]}])],
      grid
    );

    expect(merged.meta.yAxis.start).toBe(0);
    expect(merged.meta.yAxis.end).toBe(100);
    // z-range spans only populated cells: min 2, max 9.
    expect(merged.meta.zAxis.start).toBe(2);
    expect(merged.meta.zAxis.end).toBe(9);
  });

  it('has no duplicate [x,y] cells', () => {
    const merged = mergeHeatMapChunks([makeChunk([{x: 0, z: [1, 2]}])], grid);
    const keys = merged.values.map(v => `${v.xAxis}|${v.yAxis}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('metricHeatmapCombine', () => {
  // A chunked plan covering [0, 2h).
  const RESOLVED = {
    isChunked: true,
    fullRange: {start: 0, end: 2 * HOUR},
    intervalMs: HOUR,
  };
  const combine = metricHeatmapCombine({...RESOLVED, unit: undefined});

  // Minimal query-result fakes — the combine only reads these fields.
  function success(series: HeatMapSeries): UseQueryResult<HeatMapSeries> {
    return {
      isSuccess: true,
      isError: false,
      isPending: false,
      fetchStatus: 'idle',
      data: series,
      error: null,
    } as unknown as UseQueryResult<HeatMapSeries>;
  }
  function loading(): UseQueryResult<HeatMapSeries> {
    return {
      isSuccess: false,
      isError: false,
      isPending: true,
      fetchStatus: 'fetching',
      data: undefined,
      error: null,
    } as unknown as UseQueryResult<HeatMapSeries>;
  }
  function failed(error: Error): UseQueryResult<HeatMapSeries> {
    return {
      isSuccess: false,
      isError: true,
      isPending: false,
      fetchStatus: 'idle',
      data: undefined,
      error,
    } as unknown as UseQueryResult<HeatMapSeries>;
  }

  const older = makeChunk([{x: 0, z: [1, 2]}]);
  const newer = makeChunk([{x: HOUR, z: [3, 4]}]);

  it('merges succeeded chunk responses into one dense, ordered grid', () => {
    const out = combine([success(newer), success(older)]);
    expect(out.series?.values).toHaveLength(4); // 2 columns x 2 y buckets
    expect(out.series?.values.map(v => v.xAxis)).toEqual([0, 0, HOUR, HOUR]);
    expect(out.isPartial).toBe(false);
    expect(out.isFetchingMore).toBe(false);
    expect(out.error).toBeNull();
  });

  it('has no series until a chunk resolves', () => {
    expect(combine([loading(), loading()]).series).toBeUndefined();
  });

  it('flags fetchingMore while some chunks stream in', () => {
    const out = combine([success(older), loading()]);
    expect(out.series).toBeDefined();
    expect(out.isFetchingMore).toBe(true);
  });

  it('flags partial and keeps survivors when a chunk errors', () => {
    const out = combine([success(older), failed(new Error('boom'))]);
    expect(out.series).toBeDefined();
    expect(out.isPartial).toBe(true);
    expect(out.error).toBeNull();
  });

  it('surfaces a fatal error only when every chunk fails', () => {
    const err = new Error('boom');
    const out = combine([failed(err), failed(new Error('other'))]);
    expect(out.error).toBe(err);
    expect(out.series).toBeUndefined();
  });
});
