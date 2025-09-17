import {
  getMetricDetectorSuffix,
  getStaticDetectorThresholdSuffix,
} from './metricDetectorSuffix';

describe('getStaticDetectorThresholdSuffix', () => {
  it('returns empty string for integer aggregate', () => {
    expect(getStaticDetectorThresholdSuffix('count()')).toBe('');
  });

  it('returns empty string for number aggregate', () => {
    expect(getStaticDetectorThresholdSuffix('avg(stack.colno)')).toBe('');
  });

  it('returns empty string for string aggregate', () => {
    expect(getStaticDetectorThresholdSuffix('any(transaction)')).toBe('');
  });

  it('returns % for percentage aggregate', () => {
    expect(getStaticDetectorThresholdSuffix('failure_rate()')).toBe('%');
  });

  it('returns ms for duration aggregate', () => {
    expect(getStaticDetectorThresholdSuffix('p95(transaction.duration)')).toBe('ms');
    expect(getStaticDetectorThresholdSuffix('avg(transaction.duration)')).toBe('ms');
  });

  it('returns ms for date aggregate', () => {
    expect(getStaticDetectorThresholdSuffix('max(timestamp)')).toBe('ms');
  });
});

describe('getMetricDetectorSuffix', () => {
  const aggregate = 'avg(span.duration)';

  it('returns % for percent detection type', () => {
    expect(getMetricDetectorSuffix('percent', aggregate)).toBe('%');
  });

  it('returns ms as default for static detection type with duration aggregate', () => {
    expect(getMetricDetectorSuffix('static', aggregate)).toBe('ms');
  });

  it('returns ms as default for dynamic detection type with duration aggregate', () => {
    expect(getMetricDetectorSuffix('dynamic', aggregate)).toBe('ms');
  });
});
