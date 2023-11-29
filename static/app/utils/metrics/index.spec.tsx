import {PageFilters} from 'sentry/types';
import {
  formatMetricsUsingUnitAndOp,
  getDateTimeParams,
  getMetricsApiRequestQuery,
  getMetricsInterval,
} from 'sentry/utils/metrics';

describe('formatMetricsUsingUnitAndOp', () => {
  it('should format the value according to the unit', () => {
    // Test cases for different units
    expect(formatMetricsUsingUnitAndOp(123456, 'millisecond')).toEqual('2.06min');
    expect(formatMetricsUsingUnitAndOp(5000, 'second')).toEqual('1.39hr');
    expect(formatMetricsUsingUnitAndOp(600, 'byte')).toEqual('600 B');
    expect(formatMetricsUsingUnitAndOp(4096, 'kibibyte')).toEqual('4.0 MiB');
    expect(formatMetricsUsingUnitAndOp(3145728, 'megabyte')).toEqual('3.15 TB');
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
      interval: '12h',
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

describe('getMetricsInterval', () => {
  it('should return the correct interval for non-"1m" intervals', () => {
    const dateTimeObj = {start: '2023-01-01', end: '2023-01-31'};
    const useCase = 'sessions';

    const result = getMetricsInterval(dateTimeObj, useCase);

    expect(result).toBe('12h');
  });

  it('should return "10s" interval for "1m" interval within 60 minutes and custom use case', () => {
    const dateTimeObj = {start: '2023-01-01', end: '2023-01-01T00:59:00.000Z'};
    const useCase = 'custom';

    const result = getMetricsInterval(dateTimeObj, useCase);

    expect(result).toBe('10s');
  });

  it('should return "1m" interval for "1m" interval beyond 60 minutes', () => {
    const dateTimeObj = {start: '2023-01-01', end: '2023-01-01T01:05:00.000Z'};
    const useCase = 'sessions';

    const result = getMetricsInterval(dateTimeObj, useCase);

    expect(result).toBe('1m');
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
