import type {UseQueryResult} from '@tanstack/react-query';
import {HeatMapSeriesFixture} from 'sentry-fixture/heatMapSeries';

import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {
  makePartitionedHeatMapWindowCombiner,
  mergeHeatMapChunks,
} from 'sentry/views/explore/metrics/hooks/metricHeatMapCombine';

describe('mergeHeatMapChunks', () => {
  it('Throws when given no chunks', () => {
    expect(() => mergeHeatMapChunks([], {start: 0, end: 3 * HOUR}, HOUR)).toThrow();
  });

  it('Builds a dense, full-range grid ordered x-major then y-minor', () => {
    // Only the first two columns are loaded; the third is missing.
    const chunk = makeChunk([
      {x: 0, z: [1, 2]},
      {x: HOUR, z: [3, 4]},
    ]);

    const timeDomain = {start: 0, end: 3 * HOUR};

    const merged = mergeHeatMapChunks([chunk], timeDomain, HOUR);

    // 3 columns x 2 y buckets, so 6 total values in the heat map
    expect(merged.values).toHaveLength(6);
    expect(merged.values.map(v => [v.xAxis, v.yAxis])).toEqual([
      [0, 0],
      [0, 50],
      [HOUR, 0],
      [HOUR, 50],
      [2 * HOUR, 0],
      [2 * HOUR, 50],
    ]);

    // The unloaded column exists but is empty
    expect(merged.values.slice(4)).toEqual([
      {xAxis: 2 * HOUR, yAxis: 0, zAxis: null},
      {xAxis: 2 * HOUR, yAxis: 50, zAxis: null},
    ]);

    // Meta contains the full range
    expect(merged.meta.xAxis.start).toBe(0);
    expect(merged.meta.xAxis.end).toBe(3 * HOUR);
    expect(merged.meta.xAxis.bucketCount).toBe(3);
  });

  it('Orders columns ascending even when chunks are passed newest-first', () => {
    const newest = makeChunk([{x: 2 * HOUR, z: [5, 6]}]);
    const oldest = makeChunk([{x: 0, z: [1, 2]}]);

    const merged = mergeHeatMapChunks([newest, oldest], {start: 0, end: 3 * HOUR}, HOUR);

    const xs = merged.values.map(v => v.xAxis);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));

    // The loaded cells keep their values at the right coordinates.
    expect(merged.values.find(v => v.xAxis === 0 && v.yAxis === 0)?.zAxis).toBe(1);
    expect(merged.values.find(v => v.xAxis === 2 * HOUR && v.yAxis === 50)?.zAxis).toBe(
      6
    );
  });

  it('Reconciles an overlapping column by taking the (max) copy', () => {
    // Two relative chunks that overlap at HOUR: one holds the partial (pre-seam)
    // count, the other the complete bucket.
    const partial = makeChunk([
      {x: 0, z: [1, 1]},
      {x: HOUR, z: [2, 2]}, // partial half of the seam bucket
    ]);
    const complete = makeChunk([
      {x: HOUR, z: [7, 7]}, // other half of seam bucket
      {x: 2 * HOUR, z: [3, 3]},
    ]);

    const merged = mergeHeatMapChunks(
      [partial, complete],
      {start: 0, end: 3 * HOUR},
      HOUR
    );

    expect(merged.values.find(v => v.xAxis === HOUR && v.yAxis === 0)?.zAxis).toBe(7);
    expect(merged.values.find(v => v.xAxis === 2 * HOUR && v.yAxis === 0)?.zAxis).toBe(3);
  });

  it('Slides the grid to end at the newest loaded bucket (live edge)', () => {
    // Planned range is [0, 2h), but a chunk loaded a bucket at 2h — the grid
    // extends to include it and slides its start to keep the width.
    const merged = mergeHeatMapChunks(
      [makeChunk([{x: 2 * HOUR, z: [5, 5]}])],
      {start: 0, end: 2 * HOUR},
      HOUR
    );

    expect(merged.meta.xAxis.start).toBe(HOUR);
    expect(merged.meta.xAxis.end).toBe(3 * HOUR);
    expect(merged.values.find(v => v.xAxis === 2 * HOUR && v.yAxis === 0)?.zAxis).toBe(5);

    // The oldest planned column (0) slid off the fixed-width window.
    expect(merged.values.some(v => v.xAxis === 0)).toBe(false);
  });
});

describe('makePartitionedHeatMapWindowCombiner', () => {
  it('reports a settled series when every chunk succeeds', () => {
    const out = combine([success(newer), success(older)]);
    expect(out.series).toBeDefined();
    expect(out.isPartial).toBe(false);
    expect(out.isFetchingMore).toBe(false);
    expect(out.error).toBeNull();
  });

  it('Has no series until a chunk resolves', () => {
    expect(combine([loading(), loading()]).series).toBeUndefined();
  });

  it('Flags fetchingMore while some chunks stream in', () => {
    const out = combine([success(older), loading()]);
    expect(out.series).toBeDefined();
    expect(out.isFetchingMore).toBe(true);
  });

  it('Flags partial and keeps survivors when a chunk errors', () => {
    const out = combine([success(older), failed(new Error('boom'))]);
    expect(out.series).toBeDefined();
    expect(out.isPartial).toBe(true);
    expect(out.error).toBeNull();
  });

  it('Surfaces a fatal error only when every chunk fails', () => {
    const err = new Error('boom');
    const out = combine([failed(err), failed(new Error('other'))]);
    expect(out.error).toBe(err);
    expect(out.series).toBeUndefined();
  });
});

const HOUR = 60 * 60 * 1000;

// Two pinned y buckets shared by every chunk.
const Y_VALUES = [0, 50];

function makeChunk(columns: Array<{x: number; z: [number, number]}>): HeatMapSeries {
  const values = columns.flatMap(({x, z}) =>
    Y_VALUES.map((y, i) => ({xAxis: x, yAxis: y, zAxis: z[i]!}))
  );
  return HeatMapSeriesFixture({values});
}

// A combiner over a plan covering [0, 2h); chunking is inferred from the number
// of results.
const combine = makePartitionedHeatMapWindowCombiner({
  timeDomain: {start: 0, end: 2 * HOUR},
  intervalMs: HOUR,
});
const older = makeChunk([{x: 0, z: [1, 2]}]);
const newer = makeChunk([{x: HOUR, z: [3, 4]}]);

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
