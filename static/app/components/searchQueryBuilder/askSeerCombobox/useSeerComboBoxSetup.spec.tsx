import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {ChartType} from 'sentry/views/insights/common/components/chart';

import {
  buildSeerDateTimeSelection,
  mapSeerResponseItem,
  transformSeerResponse,
  useInitialSeerQuery,
  useSelectedProjectIds,
  useSelectedProjectIdsForMutation,
} from './useSeerComboBoxSetup';

const defaultProviderProps = {
  enableAISearch: true,
  filterKeys: {},
  getTagValues: () => Promise.resolve([]),
  initialQuery: '',
  searchSource: 'test' as const,
};

function makeWrapper(providerProps = {}) {
  return function Wrapper({children}: {children: React.ReactNode}) {
    return (
      <SearchQueryBuilderProvider {...defaultProviderProps} {...providerProps}>
        {children}
      </SearchQueryBuilderProvider>
    );
  };
}

describe('transformSeerResponse', () => {
  const mapItem = (r: any) => ({
    query: r?.query ?? '',
    sort: r?.sort ?? '',
    groupBys: r?.group_by ?? [],
    statsPeriod: r?.stats_period ?? '',
    start: r?.start ?? null,
    end: r?.end ?? null,
  });

  it('transforms a response with responses array', () => {
    const rawResponse = {
      responses: [
        {
          query: 'is:unresolved',
          sort: '-count',
          group_by: ['project'],
          stats_period: '24h',
          start: null,
          end: null,
          mode: 'samples',
        },
      ],
    };

    const result = transformSeerResponse(rawResponse as any, mapItem);

    expect(result).toEqual([
      {
        query: 'is:unresolved',
        sort: '-count',
        groupBys: ['project'],
        statsPeriod: '24h',
        start: null,
        end: null,
      },
    ]);
  });

  it('wraps a single response without responses array', () => {
    const singleResponse = {
      query: 'is:unresolved',
      sort: '',
      groupBys: [],
      statsPeriod: '24h',
      start: null,
      end: null,
    };

    const result = transformSeerResponse(singleResponse, mapItem);

    expect(result).toEqual([singleResponse]);
  });

  it('handles empty responses array', () => {
    const rawResponse = {responses: []};
    const result = transformSeerResponse(rawResponse as any, mapItem);
    expect(result).toEqual([]);
  });

  it('maps visualization fields when present', () => {
    const rawResponse = {
      responses: [
        {
          query: 'span.op:db',
          sort: '',
          group_by: [],
          stats_period: '1h',
          start: null,
          end: null,
          mode: 'spans',
          visualization: [{chart_type: 1, y_axes: ['count()']}],
        },
      ],
    };

    const mapWithViz = (r: any) => ({
      query: r?.query ?? '',
      visualizations:
        r?.visualization?.map((v: any) => ({
          chartType: v.chart_type,
          yAxes: v.y_axes ?? [],
        })) ?? [],
    });

    const result = transformSeerResponse(rawResponse as any, mapWithViz);

    expect(result).toEqual([
      {
        query: 'span.op:db',
        visualizations: [{chartType: 1, yAxes: ['count()']}],
      },
    ]);
  });

  it('attaches expandedProjectIds when Seer broadened beyond the selection', () => {
    const rawResponse = {
      project_ids: [1, 2, 3],
      responses: [
        {
          query: 'is:unresolved',
          sort: '',
          group_by: [],
          stats_period: '24h',
          start: null,
          end: null,
          mode: 'samples',
        },
      ],
    };

    const result = transformSeerResponse(rawResponse as any, mapItem, [1, 2]);

    expect(result[0]).toEqual(expect.objectContaining({expandedProjectIds: [1, 2, 3]}));
  });

  it('omits expandedProjectIds when the scope matches the selection', () => {
    const rawResponse = {
      project_ids: [1, 2],
      responses: [
        {
          query: 'is:unresolved',
          sort: '',
          group_by: [],
          stats_period: '24h',
          start: null,
          end: null,
          mode: 'samples',
        },
      ],
    };

    const result = transformSeerResponse(rawResponse as any, mapItem, [1, 2]);

    expect(result[0]).not.toHaveProperty('expandedProjectIds');
  });
});

describe('mapSeerResponseItem', () => {
  it('maps Seer response fields into the shared query shape', () => {
    expect(
      mapSeerResponseItem({
        query: 'span.op:db',
        sort: '-timestamp',
        group_by: ['project'],
        stats_period: '24h',
        start: null,
        end: null,
        mode: 'aggregates',
        visualization: [{chart_type: ChartType.BAR, y_axes: ['count()']}],
      })
    ).toEqual({
      query: 'span.op:db',
      sort: '-timestamp',
      groupBys: ['project'],
      statsPeriod: '24h',
      start: null,
      end: null,
      mode: 'aggregates',
      visualizations: [{chartType: ChartType.BAR, yAxes: ['count()']}],
    });
  });

  it('hoists the interval from the visualization to a top-level field', () => {
    expect(
      mapSeerResponseItem({
        query: 'span.op:db',
        sort: '',
        group_by: [],
        stats_period: '24h',
        start: null,
        end: null,
        mode: 'aggregates',
        visualization: [{chart_type: ChartType.BAR, y_axes: ['count()'], interval: '1h'}],
      })
    ).toEqual({
      query: 'span.op:db',
      sort: '',
      groupBys: [],
      statsPeriod: '24h',
      start: null,
      end: null,
      mode: 'aggregates',
      visualizations: [{chartType: ChartType.BAR, yAxes: ['count()']}],
      interval: '1h',
    });
  });

  it('hoists the interval from a plotted visualization, ignoring axis-less entries', () => {
    expect(
      mapSeerResponseItem({
        query: 'span.op:db',
        sort: '',
        group_by: [],
        stats_period: '24h',
        start: null,
        end: null,
        mode: 'aggregates',
        visualization: [
          // Dropped because it has no y-axes; its interval must not be used.
          {y_axes: [], interval: '5m'},
          {chart_type: ChartType.BAR, y_axes: ['count()'], interval: '1h'},
        ],
      })
    ).toEqual({
      query: 'span.op:db',
      sort: '',
      groupBys: [],
      statsPeriod: '24h',
      start: null,
      end: null,
      mode: 'aggregates',
      visualizations: [{chartType: ChartType.BAR, yAxes: ['count()']}],
      interval: '1h',
    });
  });

  it('leaves missing or invalid chart types undefined', () => {
    expect(
      mapSeerResponseItem(
        {
          query: 'is:unresolved',
          sort: '',
          group_by: [],
          stats_period: '',
          start: null,
          end: null,
          mode: '',
          visualization: [{y_axes: []}, {chart_type: 999, y_axes: ['count()']}],
        },
        'issues'
      )
    ).toEqual({
      query: 'is:unresolved',
      sort: '',
      groupBys: [],
      statsPeriod: '',
      start: null,
      end: null,
      mode: 'issues',
      visualizations: [{yAxes: ['count()']}],
    });
  });

  it('attaches span and log cross-events from Seer sibling queries', () => {
    expect(
      mapSeerResponseItem(
        {
          query: 'span.op:db',
          sort: '',
          group_by: [],
          stats_period: '24h',
          start: null,
          end: null,
          mode: 'samples',
          span_query: 'span.description:*pool*',
          log_query: 'severity:error',
        },
        'spans'
      )
    ).toEqual(
      expect.objectContaining({
        crossEvents: [
          {type: 'spans', query: 'span.description:*pool*'},
          {type: 'logs', query: 'severity:error'},
        ],
      })
    );
  });

  it('parses a metric cross-event from metric_query', () => {
    expect(
      mapSeerResponseItem(
        {
          query: 'span.op:db',
          sort: '',
          group_by: [],
          stats_period: '24h',
          start: null,
          end: null,
          mode: 'samples',
          metric_query:
            'metric.name:foo.duration metric.type:distribution metric.unit:millisecond value:>100',
        },
        'spans'
      )
    ).toEqual(
      expect.objectContaining({
        crossEvents: [
          {
            type: 'metrics',
            query: 'value:>100',
            metric: {name: 'foo.duration', type: 'distribution', unit: 'millisecond'},
          },
        ],
      })
    );
  });

  it('drops an aggregate-mode metric cross-event with no parseable identity', () => {
    expect(
      mapSeerResponseItem(
        {
          query: 'span.op:db',
          sort: '',
          group_by: [],
          stats_period: '24h',
          start: null,
          end: null,
          mode: 'samples',
          metric_query: 'value:>100',
        },
        'spans'
      )
    ).not.toHaveProperty('crossEvents');
  });

  it('omits crossEvents when there are no sibling queries', () => {
    expect(
      mapSeerResponseItem(
        {
          query: 'span.op:db',
          sort: '',
          group_by: [],
          stats_period: '24h',
          start: null,
          end: null,
          mode: 'samples',
        },
        'spans'
      )
    ).not.toHaveProperty('crossEvents');
  });

  it('does not build cross-events outside the spans tab', () => {
    expect(
      mapSeerResponseItem({
        query: 'is:unresolved',
        sort: '',
        group_by: [],
        stats_period: '24h',
        start: null,
        end: null,
        mode: 'samples',
        log_query: 'severity:error',
      })
    ).not.toHaveProperty('crossEvents');
  });
});

describe('buildSeerDateTimeSelection', () => {
  const relativePageFiltersDatetime = {
    start: null,
    end: null,
    period: '24h',
    utc: null,
  };
  const absolutePageFiltersDatetime = {
    start: '2024-01-01T00:00:00',
    end: '2024-01-02T00:00:00',
    period: null,
    utc: false,
  };

  it('treats Seer UTC datetimes as plain UTC when both start and end provided', () => {
    const result = buildSeerDateTimeSelection(
      '2024-06-01T00:00:00Z',
      '2024-06-02T00:00:00Z',
      '',
      relativePageFiltersDatetime
    );

    expect(result.start).toBe('2024-06-01T00:00:00');
    expect(result.end).toBe('2024-06-02T00:00:00');
    expect(result.period).toBeNull();
    // Forces UTC display so the picker matches the UTC suggestion preview,
    // even though the page filter is not in UTC.
    expect(result.utc).toBe(true);
  });

  it('falls back to the current relative datetime when Seer omits datetime', () => {
    const result = buildSeerDateTimeSelection(
      null,
      null,
      '',
      relativePageFiltersDatetime
    );

    expect(result).toEqual(relativePageFiltersDatetime);
  });

  it('falls back to the current absolute datetime when Seer omits datetime', () => {
    const result = buildSeerDateTimeSelection(
      null,
      null,
      '',
      absolutePageFiltersDatetime
    );

    expect(result).toEqual(absolutePageFiltersDatetime);
  });

  it('uses a Seer statsPeriod instead of the current absolute datetime', () => {
    const result = buildSeerDateTimeSelection(
      null,
      null,
      '7d',
      absolutePageFiltersDatetime
    );

    expect(result).toEqual({start: null, end: null, period: '7d', utc: null});
  });

  it('uses statsPeriod when relative and absolute values are provided', () => {
    const result = buildSeerDateTimeSelection(
      '2024-06-01T00:00:00',
      '2024-06-02T00:00:00',
      '7d',
      absolutePageFiltersDatetime
    );

    expect(result).toEqual({
      start: null,
      end: null,
      period: '7d',
      utc: null,
    });
  });

  it('does not shift dates without a Z suffix', () => {
    const result = buildSeerDateTimeSelection(
      '2024-06-01T12:00:00',
      '2024-06-02T12:00:00',
      '',
      relativePageFiltersDatetime
    );

    expect(result.start).toBe('2024-06-01T12:00:00');
    expect(result.end).toBe('2024-06-02T12:00:00');
  });
});

describe('useInitialSeerQuery', () => {
  it('returns empty string when no query or input', () => {
    const {result} = renderHookWithProviders(() => useInitialSeerQuery(), {
      additionalWrapper: makeWrapper({initialQuery: ''}),
    });

    expect(result.current).toBe('');
  });

  it('uses committed query when available', () => {
    const {result} = renderHookWithProviders(() => useInitialSeerQuery(), {
      additionalWrapper: makeWrapper({initialQuery: 'is:unresolved'}),
    });

    expect(result.current).toBe('is:unresolved');
  });
});

describe('useSelectedProjectIds', () => {
  beforeEach(() => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', isMember: true}),
      ProjectFixture({id: '2', isMember: true}),
      ProjectFixture({id: '3', isMember: false}),
    ]);
  });

  it('returns pageFilters projects when specified', () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [1, 2]}), false);

    const {result} = renderHookWithProviders(() => useSelectedProjectIds());

    expect(result.current).toEqual([1, 2]);
  });

  it('falls back to member projects when pageFilters has all projects', () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [-1]}), false);

    const {result} = renderHookWithProviders(() => useSelectedProjectIds());

    expect(result.current).toEqual([1, 2]);
  });

  it('falls back to member projects when pageFilters has no projects', () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: []}), false);

    const {result} = renderHookWithProviders(() => useSelectedProjectIds());

    expect(result.current).toEqual([1, 2]);
  });
});

describe('useSelectedProjectIdsForMutation', () => {
  beforeEach(() => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '10', isMember: true}),
      ProjectFixture({id: '20', isMember: false}),
    ]);
  });

  it('returns string IDs for member projects', () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [-1]}), false);

    const {result} = renderHookWithProviders(() => useSelectedProjectIdsForMutation());

    expect(result.current).toEqual(['10']);
  });

  it('returns pageFilters projects when specified', () => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({projects: [10, 20]}),
      false
    );

    const {result} = renderHookWithProviders(() => useSelectedProjectIdsForMutation());

    expect(result.current).toEqual([10, 20]);
  });
});
