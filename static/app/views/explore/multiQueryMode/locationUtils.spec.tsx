import {LocationFixture} from 'sentry-fixture/locationFixture';

import {
  getSamplesTargetAtIndex,
  normalizeCompareQueryParts,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

describe('getSamplesTargetAtIndex', () => {
  it('does not add a filter for an empty group by', () => {
    const target = getSamplesTargetAtIndex(
      0,
      [
        {
          fields: ['span.op', 'count(span.duration)'],
          groupBys: ['span.op', ''],
          query: '',
          sortBys: [{field: 'count(span.duration)', kind: 'desc'}],
          yAxes: ['count(span.duration)'],
        },
      ],
      {'span.op': 'http'},
      LocationFixture()
    );
    const queries = target.query.queries;
    const query = JSON.parse(Array.isArray(queries) ? queries[0]! : queries!);

    expect(query.groupBys).toEqual([]);
    expect(query.query).toBe('span.op:http');
  });
});

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
