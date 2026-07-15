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

    // Nothing loaded before 2h, so the empty oldest column slides off.
    expect(merged.values.some(v => v.xAxis === 0)).toBe(false);
  });

  it('Keeps older loaded columns when the live edge extends past the planned end', () => {
    // Planned range is [0, 2h). A newer chunk pushes the live edge to 2h while an
    // older chunk holds real data at 0 — the slide must not trim that column.
    const olderChunk = makeChunk([{x: 0, z: [1, 1]}]);
    const newerChunk = makeChunk([{x: 2 * HOUR, z: [5, 5]}]);

    const merged = mergeHeatMapChunks(
      [newerChunk, olderChunk],
      {start: 0, end: 2 * HOUR},
      HOUR
    );

    expect(merged.meta.xAxis.start).toBe(0);
    expect(merged.meta.xAxis.end).toBe(3 * HOUR);
    expect(merged.values.find(v => v.xAxis === 0 && v.yAxis === 0)?.zAxis).toBe(1);
    expect(merged.values.find(v => v.xAxis === 2 * HOUR && v.yAxis === 0)?.zAxis).toBe(5);
  });
});

describe('makePartitionedHeatMapWindowCombiner', () => {
  it('Reports a settled series when every chunk succeeds', () => {
    const out = combine([success(newer), success(older)]);
    expect(out.series).toBeDefined();
    expect(out.isPartial).toBe(false);
    expect(out.isFetching).toBe(false);
    expect(out.error).toBeNull();
  });

  it('Has no series until a chunk resolves', () => {
    expect(combine([loading(), loading()]).series).toBeUndefined();
  });

  it('Flags fetching while some chunks stream in', () => {
    const out = combine([success(older), loading()]);
    expect(out.series).toBeDefined();
    expect(out.isFetching).toBe(true);
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

const Y_BUCKET_SIZE = 50;
// Two pinned y buckets shared by every chunk.
const Y_VALUES = [0, Y_BUCKET_SIZE];

function makeChunk(columns: Array<{x: number; z: [number, number]}>): HeatMapSeries {
  const values = columns.flatMap(({x, z}) =>
    Y_VALUES.map((y, i) => ({xAxis: x, yAxis: y, zAxis: z[i]!}))
  );

  return HeatMapSeriesFixture({
    values,
    meta: {
      xAxis: {
        name: 'time',
        bucketCount: columns.length,
        bucketSize: HOUR,
        start: Math.min(...values.map(value => value.xAxis)),
        end: Math.max(...values.map(value => value.xAxis)),
      },
      yAxis: {
        name: 'value',
        bucketCount: Y_VALUES.length,
        bucketSize: Y_BUCKET_SIZE,
        start: Y_VALUES.at(0)!,
        end: Y_VALUES.at(-1)!,
        valueType: 'number',
        valueUnit: null,
      },
      zAxis: {
        name: 'count()',
        start: Math.min(...values.map(value => value.zAxis)),
        end: Math.max(...values.map(value => value.zAxis)),
      },
    },
  });
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
    isFetching: true,
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
