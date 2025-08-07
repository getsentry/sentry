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
  const aggregate = 'avg(span.duration)';

  it('returns % for percent detection type', function () {
    expect(getMetricDetectorSuffix('percent', aggregate)).toBe('%');
  });

  it('returns ms as default for static detection type with duration aggregate', function () {
    expect(getMetricDetectorSuffix('static', aggregate)).toBe('ms');
  });

  it('returns ms as default for dynamic detection type with duration aggregate', function () {
    expect(getMetricDetectorSuffix('dynamic', aggregate)).toBe('ms');
  });
});
