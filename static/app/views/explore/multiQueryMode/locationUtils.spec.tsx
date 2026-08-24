import {normalizeCompareQueryParts} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

describe('normalizeCompareQueryParts', () => {
  it('moves an _if condition into the query filter and plain aggregate into visualize', () => {
    expect(
      normalizeCompareQueryParts({
        query: 'span.status:ok',
        yAxes: ['avg_if(`span.op:db`,span.duration)'],
        sortBys: [{field: 'avg_if(`span.op:db`,span.duration)', kind: 'desc'}],
        chartType: ChartType.LINE,
      })
    ).toEqual({
      query: 'span.status:ok span.op:db',
      yAxes: ['avg(span.duration)'],
      sortBys: [{field: 'avg(span.duration)', kind: 'desc'}],
      chartType: ChartType.LINE,
    });
  });

  it('leaves plain aggregates and queries unchanged', () => {
    expect(
      normalizeCompareQueryParts({
        query: 'span.status:ok',
        yAxes: ['count(span.duration)'],
      })
    ).toEqual({
      query: 'span.status:ok',
      yAxes: ['count(span.duration)'],
    });
  });
});
