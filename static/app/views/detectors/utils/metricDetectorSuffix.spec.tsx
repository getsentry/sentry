import {DetectorFixture} from 'sentry-fixture/detectors';

import {
  getMetricDetectorSuffix,
  getStaticDetectorThresholdSuffix,
} from './metricDetectorSuffix';

describe('getStaticDetectorThresholdSuffix', function () {
  it('returns empty string for integer aggregate', function () {
    expect(getStaticDetectorThresholdSuffix('count()')).toBe('');
  });

  it('returns empty string for number aggregate', function () {
    expect(getStaticDetectorThresholdSuffix('avg(stack.colno)')).toBe('');
  });

  it('returns empty string for string aggregate', function () {
    expect(getStaticDetectorThresholdSuffix('any(transaction)')).toBe('');
  });

  it('returns % for percentage aggregate', function () {
    expect(getStaticDetectorThresholdSuffix('failure_rate()')).toBe('%');
  });

  it('returns ms for duration aggregate', function () {
    expect(getStaticDetectorThresholdSuffix('p95(transaction.duration)')).toBe('ms');
    expect(getStaticDetectorThresholdSuffix('avg(transaction.duration)')).toBe('ms');
  });

  it('returns ms for date aggregate', function () {
    expect(getStaticDetectorThresholdSuffix('max(timestamp)')).toBe('ms');
  });
});

describe('getMetricDetectorSuffix', function () {
  it('returns % for percent detection type', function () {
    const detector = DetectorFixture({
      id: '1',
      name: 'test',
      config: {
        detectionType: 'percent',
        comparisonDelta: 10,
        thresholdPeriod: 1,
      },
    });

    expect(getMetricDetectorSuffix(detector)).toBe('%');
  });

  it('returns ms as default for static detection type without data source', function () {
    const detector = DetectorFixture({
      config: {
        detectionType: 'static',
        thresholdPeriod: 1,
      },
    });

    expect(getMetricDetectorSuffix(detector)).toBe('ms');
  });

  it('returns ms as default for dynamic detection type without data source', function () {
    const detector = DetectorFixture({
      config: {
        detectionType: 'dynamic',
        thresholdPeriod: 1,
      },
    });

    expect(getMetricDetectorSuffix(detector)).toBe('ms');
  });
});
