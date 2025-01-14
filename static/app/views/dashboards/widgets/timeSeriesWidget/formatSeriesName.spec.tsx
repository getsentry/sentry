import {formatSeriesName} from './formatSeriesName';

describe('formatSeriesName', () => {
  describe('releases', () => {
    it.each([
      ['p75(span.duration);11762', 'p75(span.duration)'],
      ['Releases;', 'Releases'],
    ])('Formats %s as %s', (name, result) => {
      expect(formatSeriesName(name)).toEqual(result);
    });
  });

  describe('aggregates', () => {
    it.each([
      ['user_misery()', 'user_misery()'],
      ['apdex(200)', 'apdex(200)'],
      ['p75(span.duration)', 'p75(span.duration)'],
    ])('Formats %s as %s', (name, result) => {
      expect(formatSeriesName(name)).toEqual(result);
    });
  });

  describe('aggregates of measurements', () => {
    it.each([
      ['p75(measurements.lcp)', 'LCP'],
      ['p50(measurements.lcp)', 'LCP'],
    ])('Formats %s as %s', (name, result) => {
      expect(formatSeriesName(name)).toEqual(result);
    });
  });

  describe('equations', () => {
    it.each([
      ['equation|p75(measurements.cls) + 1', 'p75(measurements.cls) + 1'],
      ['equation|p75(measurements.cls)', 'p75(measurements.cls)'],
    ])('Formats %s as %s', (name, result) => {
      expect(formatSeriesName(name)).toEqual(result);
    });
  });

  describe('combinations', () => {
    it.each([
      ['equation|p75(measurements.cls) + 1;76123', 'p75(measurements.cls) + 1'],
      ['equation|p75(measurements.cls);76123', 'p75(measurements.cls)'],
    ])('Formats %s as %s', (name, result) => {
      expect(formatSeriesName(name)).toEqual(result);
    });
  });
});
