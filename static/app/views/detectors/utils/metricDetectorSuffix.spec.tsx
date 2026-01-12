import {
  getMetricDetectorSuffix,
  getStaticDetectorThresholdPlaceholder,
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

  it('returns empty string for failure_rate (stores as decimal, not percentage)', () => {
    expect(getStaticDetectorThresholdSuffix('failure_rate()')).toBe('');
  });

  it('returns % for session percentage aggregate', () => {
    expect(getStaticDetectorThresholdSuffix('crash_free_rate(session)')).toBe('%');
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

describe('getStaticDetectorThresholdPlaceholder', () => {
  it('returns 0 for integer aggregate', () => {
    expect(getStaticDetectorThresholdPlaceholder('count()')).toBe('0');
  });

  it('returns 0 for number aggregate', () => {
    expect(getStaticDetectorThresholdPlaceholder('avg(stack.colno)')).toBe('0');
  });

  it('returns 0 for duration aggregate', () => {
    expect(getStaticDetectorThresholdPlaceholder('p95(transaction.duration)')).toBe('0');
  });

  it('returns 0.05 for failure_rate (stores as decimal)', () => {
    expect(getStaticDetectorThresholdPlaceholder('failure_rate()')).toBe('0.05');
  });

  it('returns 5 for session percentage aggregate (stores as percentage)', () => {
    expect(getStaticDetectorThresholdPlaceholder('crash_free_rate(session)')).toBe('5');
  });
});
