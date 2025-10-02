import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {formatTimeSeriesLabel} from './formatTimeSeriesLabel';

describe('formatSeriesName', () => {
  describe('releases', () => {
    it.each([
      ['p75(span.duration)|~|11762', 'p75(span.duration)'],
      ['Releases|~|', 'Releases'],
    ])('Formats %s as %s', (name, result) => {
      const timeSeries = TimeSeriesFixture({
        yAxis: name,
      });

      expect(formatTimeSeriesLabel(timeSeries)).toEqual(result);
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

      expect(formatTimeSeriesLabel(timeSeries)).toEqual(result);
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

      expect(formatTimeSeriesLabel(timeSeries)).toEqual(result);
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

      expect(formatTimeSeriesLabel(timeSeries)).toEqual(result);
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

      expect(formatTimeSeriesLabel(timeSeries)).toEqual(result);
    });
  });

  describe('combinations', () => {
    it.each([
      ['equation|p75(measurements.cls) + 1|~|76123', 'p75(measurements.cls) + 1'],
      ['equation|p75(measurements.cls)|~|76123', 'p75(measurements.cls)'],
    ])('Formats %s as %s', (name, result) => {
      const timeSeries = TimeSeriesFixture({
        yAxis: name,
      });

      expect(formatTimeSeriesLabel(timeSeries)).toEqual(result);
    });
  });

  describe('groupBy', () => {
    it.each([
      [
        'equation|p75(measurements.cls)|~|76123',
        [{key: 'release', value: 'v0.0.2'}],
        'v0.0.2',
      ],
      ['p95(span.duration)', [{key: 'release', value: 'v0.0.2'}], 'v0.0.2'],
      [
        'p95(span.duration)',
        [
          {key: 'release', value: 'v0.0.2'},
          {key: 'env', value: 'prod'},
        ],
        'v0.0.2,prod',
      ],
      [
        'p95(span.duration)',
        [{key: 'release', value: 'frontend@31804d9a5f0b5e4f53055467cd258e1c'}],
        '31804d9a5f0b',
      ],
      [
        'p95(span.duration)',
        [{key: 'error.type', value: ['Exception', 'TypeError']}],
        '["Exception","TypeError"]',
      ],
      [
        'p95(span.duration)',
        [{key: 'error.type', value: ['Exception', null, 'TypeError']}],
        '["Exception",null,"TypeError"]',
      ],
      ['p95(span.duration)', [{key: 'error.type', value: [null]}], '[null]'],
      ['p95(span.duration)', [{key: 'error.type', value: []}], '[]'],
      [
        'p95(span.duration)',
        [
          {key: 'error.type', value: ['Exception', null]},
          {key: 'env', value: 'prod'},
        ],
        '["Exception",null],prod',
      ],
      [
        'p95(span.duration)',
        [
          {key: 'release', value: 'v0.0.2'},
          {key: 'error.type', value: ['Exception', 'TypeError']},
        ],
        'v0.0.2,["Exception","TypeError"]',
      ],
      ['p95(span.duration)', [{key: 'counts', value: [1, 2, 3]}], '[1,2,3]'],
      ['p95(span.duration)', [{key: 'counts', value: [1, null, 3]}], '[1,null,3]'],
      [
        'p95(span.duration)',
        [{key: 'mixed', value: [null, null, null]}],
        '[null,null,null]',
      ],
    ])('Formats %s with groupBy %s as %s', (name, groupBy, result) => {
      const timeSeries = TimeSeriesFixture({
        yAxis: name,
        groupBy,
      });

      expect(formatTimeSeriesLabel(timeSeries)).toEqual(result);
    });
  });

  describe('other', () => {
    it('Formats "Other"', () => {
      const timeSeries = TimeSeriesFixture();
      timeSeries.meta = {
        ...timeSeries.meta,
        isOther: true,
      };

      expect(formatTimeSeriesLabel(timeSeries)).toBe('Other');
    });
  });
});
