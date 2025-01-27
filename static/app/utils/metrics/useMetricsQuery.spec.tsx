import type {PageFilters} from 'sentry/types/core';
import type {MetricAggregation} from 'sentry/types/metrics';
import {
  createMqlQuery,
  getMetricsQueryApiRequestPayload,
} from 'sentry/utils/metrics/useMetricsQuery';

describe('createMqlQuery', () => {
  it('should create a basic mql query', () => {
    const field = 'avg(transaction.duration)';

    const result = createMqlQuery({field});
    expect(result).toBe(`avg(transaction.duration)`);
  });

  it('should create a mql query with a query', () => {
    const field = 'avg(transaction.duration)';
    const query = 'event.type:error';

    const result = createMqlQuery({field, query});
    expect(result).toBe(`avg(transaction.duration){event.type:error}`);
  });

  it('should create a mql query with a groupBy', () => {
    const field = 'avg(transaction.duration)';
    const groupBy = ['environment'];

    const result = createMqlQuery({field, groupBy});
    expect(result).toBe(`avg(transaction.duration) by (environment)`);
  });

  it('should create a mql query with a query and groupBy', () => {
    const field = 'avg(transaction.duration)';
    const query = 'event.type:error';
    const groupBy = ['environment', 'project'];

    const result = createMqlQuery({field, query, groupBy});
    expect(result).toBe(
      `avg(transaction.duration){event.type:error} by (environment,project)`
    );
  });
});

describe('getMetricsQueryApiRequestPayload', () => {
  it('should return the correct query object with default values', () => {
    const metric = {
      query: 'error',
      groupBy: ['project'],
      mri: 'c:custom/sessions@none' as const,
      aggregation: 'avg' as MetricAggregation,
      name: 'query_1',
    };
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
      includeSeries: true,
      interval: '2h',
    });

    expect(result.body).toEqual({
      queries: [
        {
          name: 'query_1',
          mql: 'avg(c:custom/sessions@none){error} by (project)',
        },
      ],
      formulas: [{mql: '$query_1', limit: undefined, order: undefined}],
    });
  });

  it('should return the correct query object with default values (period)', () => {
    const metric = {
      mri: 'c:custom/sessions@none' as const,
      aggregation: 'avg' as MetricAggregation,
      query: 'error',
      groupBy: ['project'],
      name: 'query_1',
    };
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
      includeSeries: true,
      interval: '30m',
    });

    expect(result.body).toEqual({
      queries: [
        {
          name: 'query_1',
          mql: 'avg(c:custom/sessions@none){error} by (project)',
        },
      ],
      formulas: [{mql: '$query_1', limit: undefined, order: undefined}],
    });
  });

  it('should return the correct query object with overridden values', () => {
    const metric = {
      mri: 'c:custom/sessions@none' as const,
      aggregation: 'avg' as MetricAggregation,
      query: 'error',
      groupBy: ['project'],
      name: 'query_1',
    };
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {start: '2023-01-01', end: '2023-01-02', period: null, utc: true},
    };

    const result = getMetricsQueryApiRequestPayload([metric], filters, {
      interval: '123m',
      includeSeries: false,
    });

    expect(result.query).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-02T00:00:00.000Z',
      project: [1],
      environment: ['production'],
      includeSeries: false,
      interval: '123m',
    });

    expect(result.body).toEqual({
      queries: [
        {
          name: 'query_1',
          mql: 'avg(c:custom/sessions@none){error} by (project)',
        },
      ],
      formulas: [{mql: '$query_1', limit: undefined, order: undefined}],
    });
  });

  it('should not add a default orderBy if one is already present', () => {
    const metric = {
      mri: 'c:custom/sessions@none' as const,
      aggregation: 'avg' as MetricAggregation,
      query: 'error',
      groupBy: ['project'],
      orderBy: 'asc' as const,
      name: 'query_1',
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
      includeSeries: true,
      interval: '5m',
    });

    expect(result.body).toEqual({
      queries: [
        {
          name: 'query_1',
          mql: 'avg(c:custom/sessions@none){error} by (project)',
        },
      ],
      formulas: [{mql: '$query_1', limit: undefined, order: 'asc'}],
    });
  });

  it('should not add a default orderBy if there are no groups', () => {
    const metric = {
      mri: 'c:custom/sessions@none' as const,
      aggregation: 'avg' as MetricAggregation,
      query: 'error',
      groupBy: [],
      name: 'query_1',
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
      includeSeries: true,
      interval: '5m',
    });

    expect(result.body).toEqual({
      queries: [
        {
          name: 'query_1',
          mql: 'avg(c:custom/sessions@none){error}',
        },
      ],
      formulas: [{mql: '$query_1', limit: undefined, order: undefined}],
    });
  });

  it('should not add intervalLadder override into the request', () => {
    const metric = {
      mri: 'c:custom/test@seconds' as const,
      aggregation: 'sum' as MetricAggregation,
      query: 'error',
      groupBy: [],
      name: 'query_1',
    };
    const filters = {
      projects: [1],
      environments: ['production'],
      datetime: {start: '2023-01-01', end: '2023-01-02', period: null, utc: true},
    };

    const result = getMetricsQueryApiRequestPayload([metric], filters, {
      intervalLadder: 'metrics',
    });

    expect(result.query).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-02T00:00:00.000Z',
      project: [1],
      environment: ['production'],
      includeSeries: true,
      interval: '5m',
    });

    expect(result.body).toEqual({
      queries: [
        {
          name: 'query_1',
          mql: 'sum(c:custom/test@seconds){error}',
        },
      ],
      formulas: [{mql: '$query_1', limit: undefined, order: undefined}],
    });
  });
});
