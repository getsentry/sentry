import {
  MetricDetectorFixture,
  SnubaQueryDataSourceFixture,
} from 'sentry-fixture/detectors';

import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';

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
  const spanDurationDataSource = SnubaQueryDataSourceFixture({
    queryObj: {
      id: '1',
      status: 1,
      subscription: '1',
      snubaQuery: {
        aggregate: 'avg(span.duration)',
        dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
        id: '',
        query: '',
        timeWindow: 60,
        eventTypes: [EventTypes.TRACE_ITEM_SPAN],
      },
    },
  });
  it('returns % for percent detection type', function () {
    const detector = MetricDetectorFixture({
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

  it('returns ms as default for static detection type with duration aggregate', function () {
    const detector = MetricDetectorFixture({
      dataSources: [spanDurationDataSource],
      config: {
        detectionType: 'static',
        thresholdPeriod: 1,
      },
    });

    expect(getMetricDetectorSuffix(detector)).toBe('ms');
  });

  it('returns ms as default for dynamic detection type with duration aggregate', function () {
    const detector = MetricDetectorFixture({
      dataSources: [spanDurationDataSource],
      config: {
        detectionType: 'dynamic',
        thresholdPeriod: 1,
      },
    });

    expect(getMetricDetectorSuffix(detector)).toBe('ms');
  });
});
