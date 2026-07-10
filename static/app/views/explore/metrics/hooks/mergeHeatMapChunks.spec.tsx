import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {mergeHeatMapChunks} from 'sentry/views/explore/metrics/hooks/mergeHeatMapChunks';

function makeChunk(
  xStart: number,
  xEnd: number,
  bucketCount: number,
  values: HeatMapSeries['values']
): HeatMapSeries {
  return {
    values,
    meta: {
      xAxis: {name: 'time', start: xStart, end: xEnd, bucketCount, bucketSize: 10},
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
  it('throws when given no chunks', () => {
    expect(() => mergeHeatMapChunks([])).toThrow();
  });

  it('concatenates values and spans the x-axis across chunks', () => {
    const newer = makeChunk(20, 40, 2, [
      {xAxis: 20, yAxis: 0, zAxis: 3},
      {xAxis: 30, yAxis: 50, zAxis: 7},
    ]);
    const older = makeChunk(0, 20, 2, [
      {xAxis: 0, yAxis: 0, zAxis: 1},
      {xAxis: 10, yAxis: 50, zAxis: 9},
    ]);

    const merged = mergeHeatMapChunks([newer, older]);

    expect(merged.values).toHaveLength(4);
    expect(merged.meta.xAxis.start).toBe(0);
    expect(merged.meta.xAxis.end).toBe(40);
    expect(merged.meta.xAxis.bucketCount).toBe(4);
    // y-axis comes straight from the pinned domain.
    expect(merged.meta.yAxis.start).toBe(0);
    expect(merged.meta.yAxis.end).toBe(100);
    expect(merged.meta.yAxis.bucketCount).toBe(2);
  });

  it('recomputes the z-axis range across all merged values, ignoring nulls', () => {
    const a = makeChunk(0, 10, 1, [
      {xAxis: 0, yAxis: 0, zAxis: 5},
      {xAxis: 0, yAxis: 50, zAxis: null},
    ]);
    const b = makeChunk(10, 20, 1, [
      {xAxis: 10, yAxis: 0, zAxis: 2},
      {xAxis: 10, yAxis: 50, zAxis: 11},
    ]);

    const merged = mergeHeatMapChunks([a, b]);

    expect(merged.meta.zAxis.start).toBe(2);
    expect(merged.meta.zAxis.end).toBe(11);
  });

  it('falls back to a zeroed z-axis when there are no populated cells', () => {
    const merged = mergeHeatMapChunks([
      makeChunk(0, 10, 1, [{xAxis: 0, yAxis: 0, zAxis: null}]),
    ]);
    expect(merged.meta.zAxis.start).toBe(0);
    expect(merged.meta.zAxis.end).toBe(0);
  });

  it('flags duplicate [x,y] cells (seam regression guard)', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    mergeHeatMapChunks([
      makeChunk(0, 10, 1, [{xAxis: 0, yAxis: 0, zAxis: 1}]),
      makeChunk(0, 10, 1, [{xAxis: 0, yAxis: 0, zAxis: 2}]),
    ]);

    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('duplicate cell'));
    consoleError.mockRestore();
  });
});
