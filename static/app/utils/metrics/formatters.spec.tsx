import {
  formatMetricUsingFixedUnit,
  formattingSupportedMetricUnits,
} from 'sentry/utils/metrics/formatters';

describe('formatMetricUsingFixedUnit', () => {
  it('should return the formatted value with the short form of the given unit', () => {
    expect(formatMetricUsingFixedUnit(123456, 'millisecond')).toBe('123,456ms');
    expect(formatMetricUsingFixedUnit(2.1231245, 'kibibyte')).toBe('2.12KiB');
    expect(formatMetricUsingFixedUnit(1222.1231245, 'megabyte')).toBe('1,222.12MB');
  });

  it.each(formattingSupportedMetricUnits.filter(unit => unit !== 'none'))(
    'appends a unit (%s) for every supported one (except none)',
    unit => {
      expect(formatMetricUsingFixedUnit(1234.56, unit)).toMatch(/1,234\.56.+/);
    }
  );

  it('should not append a unit for unsupported units and "none"', () => {
    expect(formatMetricUsingFixedUnit(1234.56, 'randomunitname')).toBe('1,234.56');
    expect(formatMetricUsingFixedUnit(1234.56, 'none')).toBe('1,234.56');
  });

  it.each(['sum', 'count_unique', 'avg', 'max', 'p50', 'p75', 'p95', 'p99'])(
    'should append a unit (%s) for every operation (except count)',
    op => {
      expect(formatMetricUsingFixedUnit(1234.56, 'second', op)).toMatch(/1,234\.56s/);
    }
  );

  it('should not append a unit for count operation', () => {
    expect(formatMetricUsingFixedUnit(1234.56, 'second', 'count')).toBe('1,234.56');
  });
});
