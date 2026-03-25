import {getAggregateRollingStrategy} from './getAggregateRollingStrategy';

describe('getAggregateRollingStrategy', () => {
  describe('sum aggregates', () => {
    it.each([
      'count()',
      'count_unique(user)',
      'count_if(transaction.duration,greater,300)',
      'count_web_vitals(measurements.lcp,good)',
      'count_miserable(user,300)',
      'sum(transaction.duration)',
      'failure_count()',
    ])('classifies %s as sum', aggregate => {
      expect(getAggregateRollingStrategy(aggregate)).toBe('sum');
    });
  });

  describe('average aggregates', () => {
    it.each([
      'avg(transaction.duration)',
      'p50(transaction.duration)',
      'p75(transaction.duration)',
      'p95(transaction.duration)',
      'p99(transaction.duration)',
      'percentile(transaction.duration,0.95)',
      'min(transaction.duration)',
      'max(transaction.duration)',
      'apdex(300)',
      'failure_rate()',
      'eps()',
      'epm()',
    ])('classifies %s as average', aggregate => {
      expect(getAggregateRollingStrategy(aggregate)).toBe('average');
    });
  });

  it('defaults unknown functions to average', () => {
    expect(getAggregateRollingStrategy('unknown_func(field)')).toBe('average');
  });

  it('defaults unparseable strings to average', () => {
    expect(getAggregateRollingStrategy('not_a_function')).toBe('average');
  });
});
