import {LocationFixture} from 'sentry-fixture/locationFixture';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  getFieldsForConstructedQuery,
  getSamplesTargetAtIndex,
  encodeCompareCaseInsensitive,
  normalizeCompareQueryParts,
  useReadQueriesFromLocation,
  useUpdateQueryAtIndex,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

describe('getFieldsForConstructedQuery', () => {
  it('uses the measure argument from plain aggregates', () => {
    expect(getFieldsForConstructedQuery(['avg(span.duration)', 'count()'])).toEqual([
      'id',
      'span.duration',
      'timestamp',
    ]);
  });

  it('uses the measure argument from EAP _if aggregates, not the filter', () => {
    expect(getFieldsForConstructedQuery(['avg_if(`span.op:db`,span.duration)'])).toEqual([
      'id',
      'span.duration',
      'timestamp',
    ]);
  });
});

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

  it('parenthesizes an _if filter that contains OR so base AND binds correctly', () => {
    expect(
      normalizeCompareQueryParts({
        query: 'span.status:ok',
        yAxes: ['avg_if(`span.op:db OR span.op:http`,span.duration)'],
      })
    ).toEqual({
      query: 'span.status:ok (span.op:db OR span.op:http)',
      yAxes: ['avg(span.duration)'],
    });
  });

  it('parenthesizes a base query that contains OR when merging an _if filter', () => {
    expect(
      normalizeCompareQueryParts({
        query: 'span.status:ok OR span.status:unset',
        yAxes: ['count_if(`span.op:db`,span.duration)'],
      })
    ).toEqual({
      query: '(span.status:ok OR span.status:unset) span.op:db',
      yAxes: ['count(span.duration)'],
    });
  });
});

describe('useReadQueriesFromLocation', () => {
  const pathname = '/organizations/org-slug/explore/traces/compare/';

  const defaultQuery = {
    yAxes: ['count(span.duration)'],
    sortBys: [{kind: 'desc', field: 'timestamp'}],
    fields: ['id', 'span.duration', 'timestamp'],
    groupBys: [],
    query: '',
  };

  function readQueries(queries: string[]) {
    const {result} = renderHookWithProviders(useReadQueriesFromLocation, {
      initialRouterConfig: {location: {pathname, query: {queries}}},
    });
    return result.current;
  }

  function readQuery(query: Record<string, unknown>) {
    return readQueries([JSON.stringify(query)])[0];
  }

  function readCaseInsensitive(queries: Array<Record<string, unknown>>) {
    return readQueries(queries.map(query => JSON.stringify(query))).map(
      query => query.caseInsensitive
    );
  }

  it('keeps an explicit compare query setting', () => {
    expect(
      readCaseInsensitive([
        {yAxes: ['count(span.duration)'], query: '', caseInsensitive: '0'},
        {yAxes: ['count(span.duration)'], query: 'span.op:DB', caseInsensitive: '1'},
      ])
    ).toEqual(['0', '1']);
  });

  it('matches case when an existing compare query stores false', () => {
    expect(
      readCaseInsensitive([
        {yAxes: ['count(span.duration)'], query: '', caseInsensitive: false},
      ])
    ).toEqual(['0']);
  });

  it('reads a query when it has a single string sort', () => {
    const query = readQuery({
      chartType: ChartType.AREA,
      fields: ['id', 'timestamp'],
      groupBys: ['span.op', ''],
      query: 'span.op:db',
      sortBys: 'span.op',
      yAxes: ['count()'],
      caseInsensitive: '1',
    });

    expect(query).toEqual({
      chartType: ChartType.AREA,
      fields: ['id', 'timestamp'],
      groupBys: ['span.op', ''],
      query: 'span.op:db',
      sortBys: [{kind: 'asc', field: 'span.op'}],
      yAxes: ['count()'],
      caseInsensitive: '1',
    });
  });

  it.each([
    ['is not JSON', '{"yAxes":'],
    ['is blank', ''],
    ['is null', 'null'],
    ['is an array', '[{"yAxes":["count()"]}]'],
    ['has no y axes', '{"query":"span.op:db"}'],
    ['has y axes that are not an array', '{"yAxes":"count()"}'],
    ['has a y axis that is not a string', '{"yAxes":["count()",1]}'],
    ['has no y axis that is a function', '{"yAxes":["span.duration"]}'],
  ])('reads the default query when the param %s', (_, raw) => {
    expect(readQueries([raw, '{"yAxes":["p50(span.duration)"]}'])).toEqual([
      defaultQuery,
      expect.objectContaining({yAxes: ['p50(span.duration)']}),
    ]);
  });

  it('keeps y axes that are not functions when another y axis is', () => {
    expect(readQuery({yAxes: ['span.duration', 'count()']})?.yAxes).toEqual([
      'span.duration',
      'count()',
    ]);
  });

  it.each([
    ['caseInsensitive is true', {caseInsensitive: true}, {}],
    ['caseInsensitive is 1', {caseInsensitive: 1}, {}],
    ['caseInsensitive is null', {caseInsensitive: null}, {}],
    ['chartType is a string number', {chartType: '2'}, {chartType: ChartType.AREA}],
    ['chartType is null', {chartType: null}, {chartType: ChartType.BAR}],
    ['chartType is out of range', {chartType: 4}, {}],
    ['chartType is an enum name', {chartType: 'LINE'}, {}],
    ['chartType is an object', {chartType: {}}, {}],
    ['fields is malformed', {fields: 5}, {}],
    ['fields is stale', {fields: ['id', 'span.op']}, {}],
    ['an unknown key is present', {visualize: [{yAxes: ['count()']}]}, {}],
    ['groupBys is null', {groupBys: null}, {}],
    ['groupBys is a string', {groupBys: 'span.op'}, {}],
    ['groupBys is a number', {groupBys: 5}, {}],
    ['groupBys is an object', {groupBys: {}}, {}],
    ['query is null', {query: null}, {}],
    ['query is a number', {query: 5}, {}],
    ['query is a boolean', {query: true}, {}],
    ['query is an object', {query: {}}, {}],
    ['sortBys is a number', {sortBys: 5}, {}],
    ['sortBys is a boolean', {sortBys: true}, {}],
    ['sortBys is an object', {sortBys: {}}, {}],
  ])('reads the rest of the query when %s', (_, stored, expected) => {
    const query = readQuery({yAxes: ['p50(span.duration)'], ...stored});

    expect(query).toEqual({
      caseInsensitive: undefined,
      chartType: undefined,
      fields: ['id', 'span.duration', 'timestamp'],
      groupBys: [],
      query: '',
      sortBys: [{kind: 'desc', field: 'timestamp'}],
      yAxes: ['p50(span.duration)'],
      ...expected,
    });
  });

  it('reads group bys that are not strings as blank group bys', () => {
    const query = readQuery({
      yAxes: ['p50(span.duration)'],
      groupBys: [null, 'span.op', 1],
    });

    expect(query).toEqual(
      expect.objectContaining({
        groupBys: ['', 'span.op', ''],
        yAxes: ['p50(span.duration)'],
      })
    );
  });

  it('merges an _if filter into the query when the stored query is not a string', () => {
    const query = readQuery({yAxes: ['avg_if(`span.op:db`,span.duration)'], query: 5});

    expect(query).toEqual(
      expect.objectContaining({query: 'span.op:db', yAxes: ['avg(span.duration)']})
    );
  });

  it('skips sorts that are not strings', () => {
    const query = readQuery({
      yAxes: ['p50(span.duration)'],
      groupBys: ['span.op'],
      sortBys: [null, 1, [], '', 'span.op'],
    });

    expect(query).toEqual(
      expect.objectContaining({
        sortBys: [{kind: 'asc', field: 'span.op'}],
        yAxes: ['p50(span.duration)'],
      })
    );
  });

  it('writes a query that reads back the same when one is updated', () => {
    const stored = {
      chartType: ChartType.LINE,
      caseInsensitive: false,
      fields: ['id', 'span.duration', 'timestamp'],
      groupBys: ['span.op'],
      query: 'span.op:db',
      sortBys: ['-count(span.duration)'],
      yAxes: ['count(span.duration)'],
    };
    const {result, router} = renderHookWithProviders(
      () => ({
        queries: useReadQueriesFromLocation(),
        updateQuery: useUpdateQueryAtIndex(0),
      }),
      {
        initialRouterConfig: {
          location: {pathname, query: {queries: [JSON.stringify(stored), '']}},
        },
      }
    );
    const before = result.current.queries;

    act(() => result.current.updateQuery({}));

    expect(router.location.query.queries).toEqual([
      JSON.stringify(stored),
      JSON.stringify({
        fields: ['id', 'span.duration', 'timestamp'],
        groupBys: [],
        query: '',
        sortBys: ['-timestamp'],
        yAxes: ['count(span.duration)'],
      }),
    ]);
    expect(result.current.queries).toEqual(before);
  });
});

describe('encodeCompareCaseInsensitive', () => {
  it('writes false when matching case', () => {
    expect(encodeCompareCaseInsensitive('0')).toBe(false);
  });

  it('writes 1 when ignoring case', () => {
    expect(encodeCompareCaseInsensitive('1')).toBe('1');
  });

  it('writes nothing when the setting is unset', () => {
    expect(encodeCompareCaseInsensitive(null)).toBeUndefined();
  });
});
