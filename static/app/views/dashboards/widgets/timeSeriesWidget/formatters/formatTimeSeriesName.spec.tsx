import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {formatTimeSeriesName} from './formatTimeSeriesName';

describe('formatSeriesName', () => {
  describe('releases', () => {
    it.each([
      ['p75(span.duration);11762', 'p75(span.duration)'],
      ['Releases;', 'Releases'],
    ])('Formats %s as %s', (name, result) => {
      const timeSeries = TimeSeriesFixture({
        yAxis: name,
      });

      expect(formatTimeSeriesName(timeSeries)).toEqual(result);
    });
  });

  describe('aggregates', () => {
    it.each([
      ['user_misery()', 'user_misery()'],
      ['apdex(200)', 'apdex(200)'],
      ['p75(span.duration)', 'p75(span.duration)'],
    ])('Formats %s as %s', (name, result) => {
      const timeSeries = TimeSeriesFixture({
        yAxis: name,
      });

      expect(formatTimeSeriesName(timeSeries)).toEqual(result);
    });
  });

  describe('versions', () => {
    it.each([
      ['frontend@31804d9a5f0b5e4f53055467cd258e1c', '31804d9a5f0b'],
      ['android@5.3.1', '5.3.1'],
      ['ios@5.3.1-rc1', '5.3.1-rc1'],
    ])('Formats %s as %s', (name, result) => {
      const timeSeries = TimeSeriesFixture({
        yAxis: name,
      });

      expect(formatTimeSeriesName(timeSeries)).toEqual(result);
    });
  });

  describe('aggregates of measurements', () => {
    it.each([
      ['p75(measurements.lcp)', 'LCP'],
      ['p50(measurements.lcp)', 'LCP'],
    ])('Formats %s as %s', (name, result) => {
      const timeSeries = TimeSeriesFixture({
        yAxis: name,
      });

      expect(formatTimeSeriesName(timeSeries)).toEqual(result);
    });
  });

  describe('equations', () => {
    it.each([
      ['equation|p75(measurements.cls) + 1', 'p75(measurements.cls) + 1'],
      ['equation|p75(measurements.cls)', 'p75(measurements.cls)'],
    ])('Formats %s as %s', (name, result) => {
      const timeSeries = TimeSeriesFixture({
        yAxis: name,
      });

      expect(formatTimeSeriesName(timeSeries)).toEqual(result);
    });
  });

  describe('combinations', () => {
    it.each([
      ['equation|p75(measurements.cls) + 1;76123', 'p75(measurements.cls) + 1'],
      ['equation|p75(measurements.cls);76123', 'p75(measurements.cls)'],
    ])('Formats %s as %s', (name, result) => {
      const timeSeries = TimeSeriesFixture({
        yAxis: name,
      });

      expect(formatTimeSeriesName(timeSeries)).toEqual(result);
    });
  });

  describe('groupBy', () => {
    it.each([
      [
        'equation|p75(measurements.cls);76123',
        [{key: 'release', value: 'v0.0.2'}],
        'p75(measurements.cls) : v0.0.2',
      ],
      [
        'p95(span.duration)',
        [{key: 'release', value: 'v0.0.2'}],
        'p95(span.duration) : v0.0.2',
      ],
      [
        'p95(span.duration)',
        [
          {key: 'release', value: 'v0.0.2'},
          {key: 'env', value: 'prod'},
        ],
        'p95(span.duration) : v0.0.2,prod',
      ],
      [
        'p95(span.duration)',
        [{key: 'release', value: 'frontend@31804d9a5f0b5e4f53055467cd258e1c'}],
        'p95(span.duration) : 31804d9a5f0b',
      ],
    ])('Formats %s with groupBy %s as %s', (name, groupBy, result) => {
      const timeSeries = TimeSeriesFixture({
        yAxis: name,
        groupBy,
      });

      expect(formatTimeSeriesName(timeSeries)).toEqual(result);
    });
  });
});
