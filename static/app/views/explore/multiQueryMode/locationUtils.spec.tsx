import {LocationFixture} from 'sentry-fixture/locationFixture';

import {getSamplesTargetAtIndex} from 'sentry/views/explore/multiQueryMode/locationUtils';

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
