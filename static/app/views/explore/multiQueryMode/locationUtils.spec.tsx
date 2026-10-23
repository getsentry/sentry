import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  generateExploreCompareRoute,
  getFieldsForConstructedQuery,
  getSamplesTargetAtIndex,
  normalizeCompareQueryParts,
  useDuplicateQueryAtIndex,
  useReadQueriesFromLocation,
  useUpdateQueryAtIndex,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

describe('Compare transformations', () => {
  it('preserves independent ordered pipelines through edits, duplication, and clearing', async () => {
    const {result, router} = renderHookWithProviders(
      () => ({
        queries: useReadQueriesFromLocation(),
        update: useUpdateQueryAtIndex(0),
        duplicate: useDuplicateQueryAtIndex(),
      }),
      {
        initialRouterConfig: {
          location: {
            pathname: '/traces/compare/',
            query: {
              queries: [
                JSON.stringify({
                  yAxes: ['avg(span.duration)'],
                  transformations: ['fill(locf)', 'smooth(sma,5)'],
                }),
                JSON.stringify({
                  yAxes: ['count(span.duration)'],
                  transformations: ['fill(zero)'],
                }),
              ],
            },
          },
        },
      }
    );

    expect(result.current.queries.map(query => query.transformations)).toEqual([
      ['fill(locf)', 'smooth(sma,5)'],
      ['fill(zero)'],
    ]);
    act(() => result.current.update({chartType: ChartType.AREA}));
    await waitFor(() =>
      expect(result.current.queries[0]?.chartType).toBe(ChartType.AREA)
    );
    act(() => result.current.duplicate(0));
    await waitFor(() =>
      expect(result.current.queries.map(query => query.transformations)).toEqual([
        ['fill(locf)', 'smooth(sma,5)'],
        ['fill(locf)', 'smooth(sma,5)'],
        ['fill(zero)'],
      ])
    );
    act(() => result.current.update({transformations: []}));
    await waitFor(() =>
      expect(result.current.queries[0]?.transformations ?? []).toEqual([])
    );
    expect(router.location.query.queries).toEqual([
      expect.not.stringContaining('transformations'),
      expect.stringContaining('"transformations":["fill(locf)","smooth(sma,5)"]'),
      expect.stringContaining('"transformations":["fill(zero)"]'),
    ]);
  });

  it.each([undefined, null, 'fill(zero)', [1], ['fill(zero)', false]])(
    'ignores malformed transformations %j without losing the query',
    transformations => {
      const {result} = renderHookWithProviders(useReadQueriesFromLocation, {
        initialRouterConfig: {
          location: {
            pathname: '/traces/compare/',
            query: {
              queries: JSON.stringify({
                yAxes: ['avg(span.duration)'],
                query: 'span.op:db',
                transformations,
              }),
            },
          },
        },
      });

      expect(result.current[0]).toEqual(
        expect.objectContaining({yAxes: ['avg(span.duration)'], query: 'span.op:db'})
      );
      expect(result.current[0]?.transformations ?? []).toEqual([]);
    }
  );

  it('includes transformations in generated compare links', () => {
    const route = generateExploreCompareRoute({
      organization: OrganizationFixture(),
      location: LocationFixture(),
      mode: Mode.SAMPLES,
      queries: [{yAxes: ['avg(span.duration)'], transformations: ['fill(linear)']}],
    });

    expect(route.query?.queries).toEqual([
      expect.stringContaining('"transformations":["fill(linear)"]'),
      expect.not.stringContaining('transformations'),
    ]);
  });
});

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
