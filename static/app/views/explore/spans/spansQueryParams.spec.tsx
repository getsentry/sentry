import type {Location} from 'history';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {Mode} from 'sentry/views/explore/queryParams/mode';
import type {ReadableQueryParamsOptions} from 'sentry/views/explore/queryParams/readableQueryParams';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {getReadableQueryParamsFromLocation} from 'sentry/views/explore/spans/spansQueryParams';
import {ChartType} from 'sentry/views/insights/common/components/chart';

function locationFixture(query: Location['query']): Location {
  return LocationFixture({query});
}

function readableQueryParamOptions(
  options: Partial<ReadableQueryParamsOptions> = {}
): ReadableQueryParamsOptions {
  return {
    extrapolate: true,
    mode: Mode.SAMPLES,
    query: '',
    cursor: '',
    fields: [
      'id',
      'span.name',
      'span.description',
      'span.duration',
      'transaction',
      'timestamp',
    ],
    sortBys: [{field: 'timestamp', kind: 'desc'}],
    aggregateCursor: '',
    aggregateFields: [{groupBy: ''}, new VisualizeFunction('count(span.duration)')],
    aggregateSortBys: [
      {
        field: 'count(span.duration)',
        kind: 'desc',
      },
    ],
    ...options,
  };
}

describe('getReadableQueryParamsFromLocation', () => {
  it('decodes defaults correctly', () => {
    const location = locationFixture({});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(new ReadableQueryParams(readableQueryParamOptions()));
  });

  it('decodes extrapolation on correctly', () => {
    const location = locationFixture({extrapolate: '1'});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(readableQueryParamOptions({extrapolate: true}))
    );
  });

  it('decodes extrapolation off correctly', () => {
    const location = locationFixture({extrapolate: '0'});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(readableQueryParamOptions({extrapolate: false}))
    );
  });

  it('decodes samples mode correctly', () => {
    const location = locationFixture({mode: 'samples'});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(readableQueryParamOptions({mode: Mode.SAMPLES}))
    );
  });

  it('decodes aggregate mode correctly', () => {
    const location = locationFixture({mode: 'aggregate'});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(readableQueryParamOptions({mode: Mode.AGGREGATE}))
    );
  });

  it('defaults to samples mode for invalid mode values', () => {
    const location = locationFixture({mode: 'invalid'});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(readableQueryParamOptions({mode: Mode.SAMPLES}))
    );
  });

  it('decodes empty query correctly', () => {
    const location = locationFixture({query: ''});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(readableQueryParamOptions({query: ''}))
    );
  });

  it('decodes custom query parameter correctly', () => {
    const location = locationFixture({query: 'span.op:db'});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(readableQueryParamOptions({query: 'span.op:db'}))
    );
  });

  it('decodes empty cursor correctly', () => {
    const location = locationFixture({cursor: ''});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({cursor: '', aggregateCursor: ''})
      )
    );
  });

  it('decodes custom cursor parameter correctly', () => {
    const location = locationFixture({cursor: '0:0:1', aggregateCursor: '50:0:1'});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({cursor: '0:0:1', aggregateCursor: '50:0:1'})
      )
    );
  });

  it('decodes empty fields correctly', () => {
    const location = locationFixture({field: []});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(new ReadableQueryParams(readableQueryParamOptions()));
  });

  it('decodes custom fields correctly', () => {
    const location = locationFixture({
      field: ['id', 'span.op', 'span.duration', 'timestamp'],
    });
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          fields: ['id', 'span.op', 'span.duration', 'timestamp'],
        })
      )
    );
  });

  it('decodes custom sortBys correctly', () => {
    const location = locationFixture({sort: ['-span.duration', 'timestamp']});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          sortBys: [
            {field: 'span.duration', kind: 'desc'},
            {field: 'timestamp', kind: 'asc'},
          ],
        })
      )
    );
  });

  it('uses timestamp sort when fields include timestamp', () => {
    const location = locationFixture({field: ['id', 'span.op', 'timestamp'], sort: []});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          fields: ['id', 'span.op', 'timestamp'],
          sortBys: [{field: 'timestamp', kind: 'desc'}],
        })
      )
    );
  });

  it('falls back to first field when fields do not include timestamp', () => {
    const location = locationFixture({field: ['id', 'span.op'], sort: []});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          fields: ['id', 'span.op'],
          sortBys: [{field: 'id', kind: 'desc'}],
        })
      )
    );
  });

  it('decodes empty sort correctly', () => {
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

  it('decodes custom group bys correctly', () => {
    const location = locationFixture({groupBy: ['span.op', 'transaction']});
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          aggregateFields: [
            {groupBy: 'span.op'},
            {groupBy: 'transaction'},
            new VisualizeFunction('count(span.duration)'),
          ],
        })
      )
    );
  });

  it('decodes custom visualizes correctly', () => {
    const location = locationFixture({
      visualize: JSON.stringify({yAxes: ['count(span.duration)', 'avg(span.self_time)']}),
    });
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams.aggregateFields).toHaveLength(3);
    expect(queryParams.aggregateFields[0]).toEqual({groupBy: ''});
    expect(queryParams.aggregateFields[1]).toEqual(
      new VisualizeFunction('count(span.duration)')
    );
    expect(queryParams.aggregateFields[2]).toEqual(
      new VisualizeFunction('avg(span.self_time)')
    );
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          aggregateFields: [
            {groupBy: ''},
            new VisualizeFunction('count(span.duration)'),
            new VisualizeFunction('avg(span.self_time)'),
          ],
        })
      )
    );
  });

  it('decodes custom visualizes with chart type correctly', () => {
    const location = locationFixture({
      visualize: JSON.stringify({
        yAxes: ['count(span.duration)', 'avg(span.self_time)'],
        chartType: ChartType.LINE,
      }),
    });
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          aggregateFields: [
            {groupBy: ''},
            new VisualizeFunction('count(span.duration)', {chartType: ChartType.LINE}),
            new VisualizeFunction('avg(span.self_time)', {chartType: ChartType.LINE}),
          ],
        })
      )
    );
  });

  it('decodes custom aggregate fields correctly', () => {
    const location = locationFixture({
      aggregateField: [
        {yAxes: ['count(span.duration)'], chartType: ChartType.AREA},
        {groupBy: 'span.op'},
        {yAxes: ['p50(span.duration)', 'p75(span.duration)']},
      ].map(aggregateField => JSON.stringify(aggregateField)),
    });
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          aggregateFields: [
            new VisualizeFunction('count(span.duration)', {chartType: ChartType.AREA}),
            {groupBy: 'span.op'},
            new VisualizeFunction('p50(span.duration)'),
            new VisualizeFunction('p75(span.duration)'),
          ],
        })
      )
    );
  });

  it('decodes custom aggregatefields and inserts default group bys', () => {
    const location = locationFixture({
      aggregateField: [
        JSON.stringify({yAxes: ['count(span.duration)'], chartType: ChartType.LINE}),
      ],
    });
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          aggregateFields: [
            new VisualizeFunction('count(span.duration)', {chartType: ChartType.LINE}),
            {groupBy: ''},
          ],
        })
      )
    );
  });

  it('decodes custom aggregatefields and inserts default visualizes', () => {
    const location = locationFixture({
      aggregateField: [JSON.stringify({groupBy: 'span.op'})],
    });
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams.aggregateFields).toHaveLength(2);
    expect(queryParams.aggregateFields[0]).toEqual({groupBy: 'span.op'});
    expect(queryParams.aggregateFields[1]).toEqual(
      new VisualizeFunction('count(span.duration)')
    );
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          aggregateFields: [
            {groupBy: 'span.op'},
            new VisualizeFunction('count(span.duration)'),
          ],
        })
      )
    );
  });

  it('decodes custom aggregate sort bys correctly', () => {
    const location = locationFixture({
      aggregateField: [
        {groupBy: 'span.op'},
        {yAxes: ['p50(span.duration)']},
        {yAxes: ['avg(span.duration)'], chartType: ChartType.AREA},
      ].map(aggregateField => JSON.stringify(aggregateField)),
      aggregateSort: ['-span.op', 'avg(span.duration)'],
    });
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          aggregateFields: [
            {groupBy: 'span.op'},
            new VisualizeFunction('p50(span.duration)'),
            new VisualizeFunction('avg(span.duration)', {chartType: ChartType.AREA}),
          ],
          aggregateSortBys: [
            {field: 'span.op', kind: 'desc'},
            {field: 'avg(span.duration)', kind: 'asc'},
          ],
        })
      )
    );
  });

  it('decodes invalid aggregate sorts and falls back to first visualize', () => {
    const location = locationFixture({
      aggregateField: [{groupBy: ''}, {yAxes: ['p50(span.duration)']}].map(
        aggregateField => JSON.stringify(aggregateField)
      ),
      aggregateSort: ['-avg(span.duration)'],
    });
    const queryParams = getReadableQueryParamsFromLocation(location);
    expect(queryParams).toEqual(
      new ReadableQueryParams(
        readableQueryParamOptions({
          aggregateFields: [{groupBy: ''}, new VisualizeFunction('p50(span.duration)')],
          aggregateSortBys: [{field: 'p50(span.duration)', kind: 'desc'}],
        })
      )
    );
  });
});
