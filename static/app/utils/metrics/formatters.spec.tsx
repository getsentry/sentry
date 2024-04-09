import {
  formatMetricsUsingUnitAndOp,
  formatMetricUsingFixedUnit,
  formattingSupportedMetricUnits,
} from 'sentry/utils/metrics/formatters';

describe('formatMetricsUsingUnitAndOp', () => {
  it('should format the value according to the unit', () => {
    // Test cases for different units
    expect(formatMetricsUsingUnitAndOp(123456, 'millisecond')).toEqual('2.06min');
    expect(formatMetricsUsingUnitAndOp(5000, 'second')).toEqual('1.39hr');
    expect(formatMetricsUsingUnitAndOp(600, 'byte')).toEqual('600 B');
    expect(formatMetricsUsingUnitAndOp(4096, 'kibibyte')).toEqual('4.0 MiB');
    expect(formatMetricsUsingUnitAndOp(3145728, 'megabyte')).toEqual('3.15 TB');
    expect(formatMetricsUsingUnitAndOp(3145728, 'megabytes')).toEqual('3.15 TB');
    expect(formatMetricsUsingUnitAndOp(0.99, 'ratio')).toEqual('99%');
    expect(formatMetricsUsingUnitAndOp(99, 'percent')).toEqual('99%');
  });

  it('should handle value as null', () => {
    expect(formatMetricsUsingUnitAndOp(null, 'millisecond')).toEqual('—');
    expect(formatMetricsUsingUnitAndOp(null, 'byte')).toEqual('—');
    expect(formatMetricsUsingUnitAndOp(null, 'megabyte')).toEqual('—');
  });

  it('should format count operation as a number', () => {
    expect(formatMetricsUsingUnitAndOp(99, 'none', 'count')).toEqual('99');
    expect(formatMetricsUsingUnitAndOp(null, 'none', 'count')).toEqual('');
  });
});

describe('formatMetricUsingFixedUnit', () => {
  it('should return the formatted value with the short form of the given unit', () => {
    expect(formatMetricUsingFixedUnit(123456, 'millisecond')).toBe('123,456ms');
    expect(formatMetricUsingFixedUnit(2.1231245, 'kibibyte')).toBe('2.12KiB');
    expect(formatMetricUsingFixedUnit(1222.1231245, 'megabyte')).toBe('1,222.12MB');
  });

  it.each(formattingSupportedMetricUnits.filter(unit => unit !== 'none'))(
    'appends a unit for every supported one (except none)',
    unit => {
      expect(formatMetricUsingFixedUnit(1234.56, unit)).toMatch(/1,234\.56.+/);
    }
  );

  it('should not append a unit for unsupported units and "none"', () => {
    expect(formatMetricUsingFixedUnit(1234.56, 'randomunitname')).toBe('1,234.56');
    expect(formatMetricUsingFixedUnit(1234.56, 'none')).toBe('1,234.56');
  });

  it.each(['sum', 'count_unique', 'avg', 'max', 'p50', 'p75', 'p95', 'p99'])(
    'should append a unit for every operation (except count)',
    op => {
      expect(formatMetricUsingFixedUnit(1234.56, 'second', op)).toMatch(/1,234\.56s/);
    }
  );

  it('should not append a unit for count operation', () => {
    expect(formatMetricUsingFixedUnit(1234.56, 'second', 'count')).toBe('1,234.56');
  });
});
