import type {Location} from 'history';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {getReadableQueryParamsFromLocation} from 'sentry/views/explore/logs/logsQueryParams';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import type {ReadableQueryParamsOptions} from 'sentry/views/explore/queryParams/readableQueryParams';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

function locationFixture(query: Location['query']): Location {
  return LocationFixture({query});
}

function readableQueryParamOptions(
  options: Partial<ReadableQueryParamsOptions> = {}
): ReadableQueryParamsOptions {
  return {
    mode: Mode.SAMPLES,
    query: '',
    cursor: '',
    fields: ['timestamp', 'message'],
    sortBys: [{field: 'timestamp', kind: 'desc'}],
    aggregateCursor: '',
    aggregateFields: [{groupBy: ''}, new VisualizeFunction('count(message)')],
    aggregateSortBys: [
      {
        field: 'count(message)',
        kind: 'desc',
      },
    ],
    ...options,
  };
}

describe('getReadableQueryParamsFromLocation', function () {
  it('decodes defaults correctly', function () {
    const location = locationFixture({});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(new ReadableQueryParams(readableQueryParamOptions()));
  });

  it('decodes samples mode correctly', function () {
    const location = locationFixture({mode: 'samples'});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(readableQueryParamOptions({mode: Mode.SAMPLES}))
    );
  });

  it('decodes aggregate mode correctly', function () {
    const location = locationFixture({mode: 'aggregate'});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(readableQueryParamOptions({mode: Mode.AGGREGATE}))
    );
  });

  it('defaults to samples mode for invalid mode values', function () {
    const location = locationFixture({mode: 'invalid'});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(readableQueryParamOptions({mode: Mode.SAMPLES}))
    );
  });

  it('decodes empty query correctly', function () {
    const location = locationFixture({query: ''});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(readableQueryParamOptions({query: ''}))
    );
  });

  it('decodes custom query parameter correctly', function () {
    const location = locationFixture({logsQuery: 'message:foobar'});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(readableQueryParamOptions({query: 'message:foobar'}))
    );
  });

  it('decodes empty cursor correctly', function () {
    const location = locationFixture({cursor: ''});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(readableQueryParamOptions({cursor: ''}))
    );
  });

  it('decodes custom cursor parameter correctly', function () {
    const location = locationFixture({logsCursor: '0:0:1'});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(readableQueryParamOptions({cursor: '0:0:1'}))
    );
  });

  it('decodes empty fields correctly', function () {
    const location = locationFixture({field: []});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          fields: ['timestamp', 'message'],
        })
      )
    );
  });

  it('decodes custom fields correctly', function () {
    const location = locationFixture({
      logsFields: ['timestamp', 'severity', 'message'],
    });
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          fields: ['timestamp', 'severity', 'message'],
        })
      )
    );
  });

  it('decodes custom sortBys correctly', function () {
    const location = locationFixture({logsSortBys: ['-timestamp', 'message']});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          sortBys: [
            {field: 'timestamp', kind: 'desc'},
            {field: 'message', kind: 'asc'},
          ],
        })
      )
    );
  });

  it('uses timestamp sort when fields include timestamp', function () {
    const location = locationFixture({logsSortBys: ['severity']});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          sortBys: [{field: 'timestamp', kind: 'desc'}],
        })
      )
    );
  });

  it('falls back to first field when fields do not include timestamp', function () {
    const location = locationFixture({logsFields: ['severity', 'message'], sort: []});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          fields: ['severity', 'message'],
          sortBys: [{field: 'severity', kind: 'desc'}],
        })
      )
    );
  });

  it('decodes empty sort correctly', function () {
    const location = locationFixture({sort: []});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          sortBys: [{field: 'timestamp', kind: 'desc'}],
        })
      )
    );
  });

  it('decodes custom group bys correctly', function () {
    const location = locationFixture({logsGroupBy: 'severity'});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          aggregateFields: [
            {groupBy: 'severity'},
            new VisualizeFunction('count(message)'),
          ],
        })
      )
    );
  });

  it('decodes custom visualizes correctly', function () {
    const location = locationFixture({logsAggregate: 'avg', logsAggregateParam: 'foo'});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          aggregateFields: [{groupBy: ''}, new VisualizeFunction('avg(foo)')],
          aggregateSortBys: [{field: 'avg(foo)', kind: 'desc'}],
        })
      )
    );
  });

  it('decodes custom aggregate sort bys correctly', function () {
    const location = locationFixture({
      logsGroupBy: 'severity',
      logsAggregate: 'avg',
      logsAggregateParam: 'foo',
      logsAggregateSortBys: '-severity',
    });
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          aggregateFields: [{groupBy: 'severity'}, new VisualizeFunction('avg(foo)')],
          aggregateSortBys: [{field: 'severity', kind: 'desc'}],
        })
      )
    );
  });
});
