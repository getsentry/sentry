import type {PageFilters} from 'sentry/types';
import {
  createMqlQuery,
  getMetricsQueryApiRequestPayload,
} from 'sentry/utils/metrics/useMetricsQuery';

describe('createMqlQuery', () => {
  it('should create a basic mql query', () => {
    const field = 'avg(transaction.duration)';

    const result = createMqlQuery({field});
    expect(result).toEqual(`avg(transaction.duration)`);
  });

  it('should create a mql query with a query', () => {
    const field = 'avg(transaction.duration)';
    const query = 'event.type:error';

    const result = createMqlQuery({field, query});
    expect(result).toEqual(`avg(transaction.duration){event.type:error}`);
  });

  it('should create a mql query with a groupBy', () => {
    const field = 'avg(transaction.duration)';
    const groupBy = ['environment'];

    const result = createMqlQuery({field, groupBy});
    expect(result).toEqual(`avg(transaction.duration) by (environment)`);
  });

  it('should create a mql query with a query and groupBy', () => {
    const field = 'avg(transaction.duration)';
    const query = 'event.type:error';
    const groupBy = ['environment', 'project'];

    const result = createMqlQuery({field, query, groupBy});
    expect(result).toEqual(
      `avg(transaction.duration){event.type:error} by (environment,project)`
    );
  });
});

describe('getMetricsQueryApiRequestPayload', () => {
  it('should return the correct query object with default values', () => {
    const metric = {field: 'sessions', query: 'error', groupBy: ['project']};
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {start: '2023-01-01', end: '2023-01-31', period: null, utc: true},
    };

    const result = getMetricsQueryApiRequestPayload([metric], filters);

    expect(result.query).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-31T00:00:00.000Z',
      project: [1],
      environment: ['production'],
      interval: '2h',
    });

    expect(result.body).toEqual({
      queries: [
        {
          name: 'query_1',
          mql: 'sessions{error} by (project)',
        },
      ],
      formulas: [{mql: '$query_1', limit: undefined, order: 'desc'}],
    });
  });

  it('should return the correct query object with default values (period)', () => {
    const metric = {field: 'sessions', query: 'error', groupBy: ['project']};
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {period: '7d', utc: true} as PageFilters['datetime'],
    };

    const result = getMetricsQueryApiRequestPayload([metric], filters);

    expect(result.query).toEqual({
      statsPeriod: '7d',
      project: [1],
      environment: ['production'],
      interval: '30m',
    });

    expect(result.body).toEqual({
      queries: [
        {
          name: 'query_1',
          mql: 'sessions{error} by (project)',
        },
      ],
      formulas: [{mql: '$query_1', limit: undefined, order: 'desc'}],
    });
  });

  it('should return the correct query object with overridden values', () => {
    const metric = {field: 'sessions', query: 'error', groupBy: ['project']};
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {start: '2023-01-01', end: '2023-01-02', period: null, utc: true},
    };

    const result = getMetricsQueryApiRequestPayload([metric], filters, {
      interval: '123m',
    });

    expect(result.query).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-02T00:00:00.000Z',
      project: [1],
      environment: ['production'],
      interval: '123m',
    });

    expect(result.body).toEqual({
      queries: [
        {
          name: 'query_1',
          mql: 'sessions{error} by (project)',
        },
      ],
      formulas: [{mql: '$query_1', limit: undefined, order: 'desc'}],
    });
  });

  it('should not add a default orderBy if one is already present', () => {
    const metric = {
      field: 'sessions',
      query: 'error',
      groupBy: ['project'],
      orderBy: 'asc' as const,
    };
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {start: '2023-01-01', end: '2023-01-02', period: null, utc: true},
    };

    const result = getMetricsQueryApiRequestPayload([metric], filters);

    expect(result.query).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-02T00:00:00.000Z',
      project: [1],
      environment: ['production'],
      interval: '5m',
    });

    expect(result.body).toEqual({
      queries: [
        {
          name: 'query_1',
          mql: 'sessions{error} by (project)',
        },
      ],
      formulas: [{mql: '$query_1', limit: undefined, order: 'asc'}],
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

    const result = getMetricsQueryApiRequestPayload([metric], filters);

    expect(result.query).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-02T00:00:00.000Z',
      project: [1],
      environment: ['production'],
      interval: '5m',
    });

    expect(result.body).toEqual({
      queries: [
        {
          name: 'query_1',
          mql: 'sessions{error}',
        },
      ],
      formulas: [{mql: '$query_1', limit: undefined, order: undefined}],
    });
  });

  it('should not add intervalLadder override into the request', () => {
    const metric = {
      field: 'test',
      query: 'error',
      groupBy: [],
    };
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {start: '2023-01-01', end: '2023-01-02', period: null, utc: true},
    };

    const result = getMetricsQueryApiRequestPayload([metric], filters, {
      intervalLadder: 'ddm',
    });

    expect(result.query).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-02T00:00:00.000Z',
      project: [1],
      environment: ['production'],
      interval: '5m',
    });

    expect(result.body).toEqual({
      queries: [
        {
          name: 'query_1',
          mql: 'test{error}',
        },
      ],
      formulas: [{mql: '$query_1', limit: undefined, order: undefined}],
    });
  });
});
