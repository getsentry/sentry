import type {Series} from 'sentry/types/echarts';

import {applyRollingWindow} from './applyRollingWindow';

function makeSeries(values: number[]): Series {
  return {
    seriesName: 'test',
    data: values.map((value, i) => ({
      name: i * 60000,
      value,
    })),
  };
}

describe('applyRollingWindow', () => {
  it('returns series unchanged when windowSize is 1', () => {
    const series = makeSeries([1, 2, 3, 4, 5]);
    const result = applyRollingWindow(series, 1, 'sum');
    expect(result).toBe(series);
  });

  it('returns series unchanged when windowSize is 0', () => {
    const series = makeSeries([1, 2, 3]);
    const result = applyRollingWindow(series, 0, 'sum');
    expect(result).toBe(series);
  });

  it('handles empty series', () => {
    const series: Series = {seriesName: 'test', data: []};
    const result = applyRollingWindow(series, 3, 'sum');
    expect(result.data).toEqual([]);
  });

  it('handles single data point', () => {
    const series = makeSeries([5]);
    const result = applyRollingWindow(series, 3, 'sum');
    expect(result.data[0]!.value).toBe(5);
  });

  describe('rolling sum', () => {
    it('computes rolling sum with uniform values', () => {
      const series = makeSeries([10, 10, 10, 10, 10]);
      const result = applyRollingWindow(series, 3, 'sum');
      expect(result.data.map(d => d.value)).toEqual([
        10, // partial: [10]
        20, // partial: [10, 10]
        30, // full: [10, 10, 10]
        30, // full: [10, 10, 10]
        30, // full: [10, 10, 10]
      ]);
    });

    it('computes rolling sum with varying values', () => {
      const series = makeSeries([1, 2, 3, 4, 5]);
      const result = applyRollingWindow(series, 3, 'sum');
      expect(result.data.map(d => d.value)).toEqual([
        1, // [1]
        3, // [1, 2]
        6, // [1, 2, 3]
        9, // [2, 3, 4]
        12, // [3, 4, 5]
      ]);
    });
  });

  describe('rolling average', () => {
    it('computes rolling average with uniform values', () => {
      const series = makeSeries([10, 10, 10, 10, 10]);
      const result = applyRollingWindow(series, 3, 'average');
      expect(result.data.map(d => d.value)).toEqual([10, 10, 10, 10, 10]);
    });

    it('computes rolling average with varying values', () => {
      const series = makeSeries([1, 2, 3, 4, 5]);
      const result = applyRollingWindow(series, 3, 'average');
      expect(result.data.map(d => d.value)).toEqual([
        1, // [1] / 1
        1.5, // [1, 2] / 2
        2, // [1, 2, 3] / 3
        3, // [2, 3, 4] / 3
        4, // [3, 4, 5] / 3
      ]);
    });
  });

  it('preserves series metadata', () => {
    const series: Series = {
      seriesName: 'my-series',
      color: '#ff0000',
      data: [
        {name: 1000, value: 5},
        {name: 2000, value: 10},
      ],
    };
    const result = applyRollingWindow(series, 2, 'sum');
    expect(result.seriesName).toBe('my-series');
    expect(result.color).toBe('#ff0000');
  });

  it('preserves data point metadata', () => {
    const series: Series = {
      seriesName: 'test',
      data: [
        {name: 1000, value: 5, itemStyle: {color: 'red'}},
        {name: 2000, value: 10, itemStyle: {color: 'blue'}},
      ],
    };
    const result = applyRollingWindow(series, 2, 'sum');
    expect(result.data[0]!.itemStyle).toEqual({color: 'red'});
    expect(result.data[1]!.itemStyle).toEqual({color: 'blue'});
  });
});
