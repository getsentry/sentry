import type {
  MetricsApiRequestQueryOptions,
  MetricsOperation,
  PageFilters,
} from 'sentry/types';
import {
  getAbsoluteDateTimeRange,
  getDateTimeParams,
  getDDMInterval,
  getMetricsApiRequestQuery,
  stringifyMetricWidget,
} from 'sentry/utils/metrics';

describe('getMetricsApiRequestQuery', () => {
  it('should return the correct query object with default values', () => {
    const metric = {field: 'sessions', query: 'error', groupBy: ['project']};
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {start: '2023-01-01', end: '2023-01-31', period: null, utc: true},
    };

    const result = getMetricsApiRequestQuery(metric, filters);

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
      orderBy: '-sessions',
      useNewMetricsLayer: true,
    });
  });

  it('should return the correct query object with default values (period)', () => {
    const metric = {field: 'sessions', query: 'error', groupBy: ['project']};
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {period: '7d', utc: true} as PageFilters['datetime'],
    };

    const result = getMetricsApiRequestQuery(metric, filters);

    expect(result).toEqual({
      statsPeriod: '7d',
      query: 'error',
      project: [1],
      environment: ['production'],
      field: 'sessions',
      useCase: 'custom',
      interval: '30m',
      groupBy: ['project'],
      orderBy: '-sessions',
      useNewMetricsLayer: true,
    });
  });

  it('should return the correct query object with overridden values', () => {
    const metric = {field: 'sessions', query: 'error', groupBy: ['project']};
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {start: '2023-01-01', end: '2023-01-02', period: null, utc: true},
    };

    const result = getMetricsApiRequestQuery(metric, filters, {groupBy: ['environment']});

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
      orderBy: '-sessions',
      useNewMetricsLayer: true,
    });
  });

  it('should not add a default orderBy if one is already present', () => {
    const metric = {
      field: 'sessions',
      query: 'error',
      groupBy: ['project'],
      orderBy: 'foo',
    };
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {start: '2023-01-01', end: '2023-01-02', period: null, utc: true},
    };

    const result = getMetricsApiRequestQuery(metric, filters);

    expect(result).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-02T00:00:00.000Z',
      query: 'error',
      project: [1],
      environment: ['production'],
      field: 'sessions',
      useCase: 'custom',
      interval: '5m',
      groupBy: ['project'],
      orderBy: 'foo',
      useNewMetricsLayer: true,
    });
  });

  it('should not add a default orderBy if there are no groups', () => {
    const metric = {
      field: 'sessions',
      query: 'error',
      groupBy: [],
    };
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {start: '2023-01-01', end: '2023-01-02', period: null, utc: true},
    };

    const result = getMetricsApiRequestQuery(metric, filters);

    expect(result).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-02T00:00:00.000Z',
      query: 'error',
      project: [1],
      environment: ['production'],
      field: 'sessions',
      useCase: 'custom',
      interval: '5m',
      groupBy: [],
      useNewMetricsLayer: true,
    });
  });

  it('should not add a default orderBy if there is no field', () => {
    const metric = {
      field: '',
      query: 'error',
      groupBy: [],
    };
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {start: '2023-01-01', end: '2023-01-02', period: null, utc: true},
    };

    const result = getMetricsApiRequestQuery(metric, filters);

    expect(result).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-02T00:00:00.000Z',
      query: 'error',
      project: [1],
      environment: ['production'],
      field: '',
      useCase: 'custom',
      interval: '5m',
      groupBy: [],
      useNewMetricsLayer: true,
    });
  });

  it('should not add all overrides into the request', () => {
    const metric = {
      field: '',
      query: 'error',
      groupBy: [],
    };
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {start: '2023-01-01', end: '2023-01-02', period: null, utc: true},
    };
    const overrides: MetricsApiRequestQueryOptions = {fidelity: 'high'};

    const result = getMetricsApiRequestQuery(metric, filters, overrides);

    expect(result).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-02T00:00:00.000Z',
      query: 'error',
      project: [1],
      environment: ['production'],
      field: '',
      useCase: 'custom',
      interval: '5m',
      groupBy: [],
      useNewMetricsLayer: true,
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
      op: '' as MetricsOperation,
      mri: 'd:custom/sentry.process_profile.symbolicate.process@second',
      groupBy: [],
      query: '',
    });

    expect(result).toEqual('');
  });
});

describe('getAbsoluteDateTimeRange', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  it('should return the correct object with "start" and "end" when period is not provided', () => {
    const datetime = {
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-01T00:00:00.000Z',
      period: null,
      utc: true,
    };
    const result = getAbsoluteDateTimeRange(datetime);

    expect(result).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-01T00:00:00.000Z',
    });
  });

  it('should return the correct object with "start" and "end" when period is provided', () => {
    const datetime = {start: null, end: null, period: '7d', utc: true};
    const result = getAbsoluteDateTimeRange(datetime);

    expect(result).toEqual({
      start: '2023-12-25T00:00:00.000Z',
      end: '2024-01-01T00:00:00.000Z',
    });
  });

  afterAll(() => {
    jest.useRealTimers();
  });
});
