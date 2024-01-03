import {PageFilters} from 'sentry/types';
import {
  formatMetricsUsingUnitAndOp,
  formatMetricUsingFixedUnit,
  formattingSupportedMetricUnits,
  getDateTimeParams,
  getDDMInterval,
  getMetricsApiRequestQuery,
  stringifyMetricWidget,
} from 'sentry/utils/metrics';

describe('formatMetricsUsingUnitAndOp', () => {
  it('should format the value according to the unit', () => {
    // Test cases for different units
    expect(formatMetricsUsingUnitAndOp(123456, 'millisecond')).toEqual('2.06min');
    expect(formatMetricsUsingUnitAndOp(5000, 'second')).toEqual('1.39hr');
    expect(formatMetricsUsingUnitAndOp(600, 'byte')).toEqual('600 B');
    expect(formatMetricsUsingUnitAndOp(4096, 'kibibyte')).toEqual('4.0 MiB');
    expect(formatMetricsUsingUnitAndOp(3145728, 'megabyte')).toEqual('3.15 TB');
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

describe('getMetricsApiRequestQuery', () => {
  it('should return the correct query object with default values', () => {
    const metric = {field: 'sessions', query: 'error', groupBy: ['project']};
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {start: '2023-01-01', end: '2023-01-31', period: null, utc: true},
    };
    const overrides = {};

    const result = getMetricsApiRequestQuery(metric, filters, overrides);

    expect(result).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-31T00:00:00.000Z',
      query: 'error',
      project: [1],
      environment: ['production'],
      field: 'sessions',
      useCase: 'custom',
      interval: '2h',
      groupBy: ['project'],
      allowPrivate: true,
      per_page: 10,
    });
  });

  it('should return the correct query object with default values (period)', () => {
    const metric = {field: 'sessions', query: 'error', groupBy: ['project']};
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {period: '7d', utc: true} as PageFilters['datetime'],
    };
    const overrides = {};

    const result = getMetricsApiRequestQuery(metric, filters, overrides);

    expect(result).toEqual({
      statsPeriod: '7d',
      query: 'error',
      project: [1],
      environment: ['production'],
      field: 'sessions',
      useCase: 'custom',
      interval: '30m',
      groupBy: ['project'],
      allowPrivate: true,
      per_page: 10,
    });
  });

  it('should return the correct query object with overridden values', () => {
    const metric = {field: 'sessions', query: 'error', groupBy: ['project']};
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {start: '2023-01-01', end: '2023-01-02', period: null, utc: true},
    };
    const overrides = {interval: '5m', groupBy: ['environment']};

    const result = getMetricsApiRequestQuery(metric, filters, overrides);

    expect(result).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-02T00:00:00.000Z',
      query: 'error',
      project: [1],
      environment: ['production'],
      field: 'sessions',
      useCase: 'custom',
      interval: '5m',
      groupBy: ['environment'],
      allowPrivate: true,
      per_page: 10,
    });
  });
});

describe('getDDMInterval', () => {
  it('should return the correct interval for non-"1m" intervals', () => {
    const dateTimeObj = {start: '2023-01-01', end: '2023-01-31'};
    const useCase = 'sessions';

    const result = getDDMInterval(dateTimeObj, useCase);

    expect(result).toBe('2h');
  });

  it('should return "10s" interval for "1m" interval within 60 minutes and custom use case', () => {
    const dateTimeObj = {
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-01T00:59:00.000Z',
    };
    const useCase = 'custom';

    const result = getDDMInterval(dateTimeObj, useCase, 'high');

    expect(result).toBe('10s');
  });

  it('should return "1m" interval for "1m" interval beyond 60 minutes', () => {
    const dateTimeObj = {start: '2023-01-01', end: '2023-01-01T01:05:00.000Z'};
    const useCase = 'sessions';

    const result = getDDMInterval(dateTimeObj, useCase);

    expect(result).toBe('1m');
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

  it('does not append a unit for unsupported units and "none"', () => {
    expect(formatMetricUsingFixedUnit(1234.56, 'randomunitname')).toBe('1,234.56');
    expect(formatMetricUsingFixedUnit(1234.56, 'none')).toBe('1,234.56');
  });

  it.each(['sum', 'count_unique', 'avg', 'max', 'p50', 'p75', 'p95', 'p99'])(
    'does append a unit for every operation (except count)',
    op => {
      expect(formatMetricUsingFixedUnit(1234.56, 'second', op)).toMatch(/1,234\.56s/);
    }
  );

  it('does not append a unit for count operation', () => {
    expect(formatMetricUsingFixedUnit(1234.56, 'second', 'count')).toBe('1,234.56');
  });
});

describe('getDateTimeParams', () => {
  it('should return the correct object with "statsPeriod" when period is provided', () => {
    const datetime = {start: '2023-01-01', end: '2023-01-31', period: '7d', utc: true};

    const result = getDateTimeParams(datetime);

    expect(result).toEqual({statsPeriod: '7d'});
  });

  it('should return the correct object with "start" and "end" when period is not provided', () => {
    const datetime = {start: '2023-01-01', end: '2023-01-31', period: null, utc: true};
    const result = getDateTimeParams(datetime);

    expect(result).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-31T00:00:00.000Z',
    });
  });
});

describe('stringifyMetricWidget', () => {
  it('should format metric widget object into a string', () => {
    const result = stringifyMetricWidget({
      op: 'avg',
      mri: 'd:custom/sentry.process_profile.symbolicate.process@second',
      groupBy: ['result'],
      query: 'result:success',
    });

    expect(result).toEqual(
      'avg(sentry.process_profile.symbolicate.process){result:success} by result'
    );
  });

  it('defaults to an empty string', () => {
    const result = stringifyMetricWidget({
      op: '',
      mri: 'd:custom/sentry.process_profile.symbolicate.process@second',
      groupBy: [],
      query: '',
    });

    expect(result).toEqual('');
  });
});
