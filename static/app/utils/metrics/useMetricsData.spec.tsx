import {createMqlQuery} from 'sentry/utils/metrics/useMetricsData';

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
