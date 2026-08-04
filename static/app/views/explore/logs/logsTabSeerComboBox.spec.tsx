import type {Location} from 'history';
import {ProjectFixture} from 'sentry-fixture/project';

import type {AskSeerSearchQuery} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {
  LOGS_AGGREGATE_CURSOR_KEY,
  LOGS_CURSOR_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {getLogsSeerLocationQuery} from 'sentry/views/explore/logs/logsTabSeerComboBox';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

const pageDatetime = {
  start: null,
  end: null,
  period: '7d',
  utc: null,
};

function seerResult(overrides: Partial<AskSeerSearchQuery>): AskSeerSearchQuery {
  return {
    query: '',
    sort: '',
    groupBys: [],
    statsPeriod: '',
    start: null,
    end: null,
    mode: 'logs',
    visualizations: [],
    ...overrides,
  };
}

function aggregateFields(query: Location['query']) {
  const rawFields = query.aggregateField;
  const fields = Array.isArray(rawFields) ? rawFields : rawFields ? [rawFields] : [];
  return fields.map(field => JSON.parse(String(field)));
}

function locationWithQuery(query: Location['query']): Location {
  return {
    action: 'PUSH',
    hash: '',
    key: '',
    pathname: '/organizations/org-slug/explore/logs/',
    query,
    search: '',
    state: undefined,
  };
}

describe('getLogsSeerLocationQuery', () => {
  it('applies raw logs response without aggregate visualization params', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({}),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      result: seerResult({
        query: 'severity:error',
        sort: '-timestamp',
        statsPeriod: '24h',
        visualizations: [{chartType: ChartType.LINE, yAxes: ['count(message)']}],
      }),
    });

    expect(query).toMatchObject({
      logsQuery: 'severity:error',
      logsSortBys: ['-timestamp'],
      mode: Mode.SAMPLES,
      statsPeriod: '24h',
    });
    expect(query.aggregateField).toBeUndefined();
    expect(query.logsAggregateSortBys).toBeUndefined();
  });

  it('applies aggregate count response with aggregate sort', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({}),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      result: seerResult({
        mode: 'aggregates',
        sort: '-count(message)',
        visualizations: [{chartType: ChartType.BAR, yAxes: ['count(message)']}],
      }),
    });

    expect(query.mode).toBe(Mode.AGGREGATE);
    expect(query.logsAggregateSortBys).toEqual(['-count(message)']);
    expect(query.logsSortBys).toBeUndefined();
    expect(aggregateFields(query)).toEqual([
      {chartType: ChartType.BAR, yAxes: ['count(message)']},
    ]);
  });

  it('applies aggregate payload percentile visualization and sort', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({}),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      result: seerResult({
        mode: 'aggregates',
        sort: '-p90(payload_size)',
        visualizations: [{chartType: ChartType.LINE, yAxes: ['p90(payload_size)']}],
      }),
    });

    expect(query.mode).toBe(Mode.AGGREGATE);
    expect(query.logsAggregateSortBys).toEqual(['-p90(payload_size)']);
    expect(aggregateFields(query)).toEqual([
      {chartType: ChartType.LINE, yAxes: ['p90(payload_size)']},
    ]);
  });

  it('does not serialize chart type when Seer does not return one', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({}),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      result: seerResult({
        mode: 'aggregates',
        visualizations: [{yAxes: ['count(message)']}],
      }),
    });

    expect(aggregateFields(query)).toEqual([{yAxes: ['count(message)']}]);
  });

  it('preserves visualize-first aggregate field order', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({}),
      currentAggregateFields: [
        new VisualizeFunction('count(message)'),
        {groupBy: 'severity'},
      ],
      pageDatetime,
      result: seerResult({
        mode: 'aggregates',
        groupBys: ['service.name', 'environment'],
        sort: '-p95(payload_size)',
        visualizations: [{chartType: ChartType.AREA, yAxes: ['p95(payload_size)']}],
      }),
    });

    expect(aggregateFields(query)).toEqual([
      {chartType: ChartType.AREA, yAxes: ['p95(payload_size)']},
      {groupBy: 'service.name'},
      {groupBy: 'environment'},
    ]);
  });

  it('clears stale pagination cursors when applying a Seer query', () => {
    const sampleQuery = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({
        [LOGS_CURSOR_KEY]: '0:100:1',
        [LOGS_AGGREGATE_CURSOR_KEY]: '0:200:1',
      }),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      result: seerResult({
        query: 'severity:error',
        sort: '-timestamp',
        mode: 'logs',
      }),
    }).query;

    expect(sampleQuery[LOGS_CURSOR_KEY]).toBeUndefined();
    expect(sampleQuery[LOGS_AGGREGATE_CURSOR_KEY]).toBeUndefined();

    const aggregateQuery = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({
        [LOGS_CURSOR_KEY]: '0:100:1',
        [LOGS_AGGREGATE_CURSOR_KEY]: '0:200:1',
      }),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      result: seerResult({
        mode: 'aggregates',
        sort: '-count(message)',
        visualizations: [{chartType: ChartType.BAR, yAxes: ['count(message)']}],
      }),
    }).query;

    expect(aggregateQuery[LOGS_CURSOR_KEY]).toBeUndefined();
    expect(aggregateQuery[LOGS_AGGREGATE_CURSOR_KEY]).toBeUndefined();
  });

  it('clears stale aggregate params when switching to samples mode', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({
        logsAggregateSortBys: ['-count(message)'],
        aggregateField: [
          JSON.stringify({chartType: ChartType.BAR, yAxes: ['count(message)']}),
        ],
      }),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      result: seerResult({
        query: 'severity:error',
        sort: '-timestamp',
        mode: 'logs',
      }),
    });

    expect(query.mode).toBe(Mode.SAMPLES);
    expect(query.logsSortBys).toEqual(['-timestamp']);
    expect(query.logsAggregateSortBys).toBeUndefined();
    expect(query.aggregateField).toBeUndefined();
  });

  it('clears stale samples sort when switching to aggregate mode', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({
        logsSortBys: ['-timestamp'],
      }),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      result: seerResult({
        mode: 'aggregates',
        sort: '-count(message)',
        visualizations: [{chartType: ChartType.BAR, yAxes: ['count(message)']}],
      }),
    });

    expect(query.mode).toBe(Mode.AGGREGATE);
    expect(query.logsAggregateSortBys).toEqual(['-count(message)']);
    expect(query.logsSortBys).toBeUndefined();
  });

  it('preserves the existing samples sort when Seer omits one', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({
        logsSortBys: ['-severity'],
      }),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      result: seerResult({
        query: 'severity:error',
        mode: 'logs',
      }),
    });

    expect(query.mode).toBe(Mode.SAMPLES);
    expect(query.logsSortBys).toEqual(['-severity']);
  });

  it('preserves the existing aggregate sort when Seer omits one', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({
        logsAggregateSortBys: ['-count(message)'],
      }),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      result: seerResult({
        query: 'severity:error',
        mode: 'aggregates',
        visualizations: [{chartType: ChartType.BAR, yAxes: ['count(message)']}],
      }),
    });

    expect(query.mode).toBe(Mode.AGGREGATE);
    expect(query.logsAggregateSortBys).toEqual(['-count(message)']);
  });

  it('uses nullable query updates for datetime params', () => {
    const relativeQuery = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({
        end: '2024-06-02T00:00:00.000Z',
        start: '2024-06-01T00:00:00.000Z',
        utc: 'true',
        period: '7d',
        pageStart: '2024-05-01T00:00:00.000Z',
        pageEnd: '2024-05-02T00:00:00.000Z',
        pageStatsPeriod: '30d',
        pageUtc: 'true',
      }),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      result: seerResult({
        query: 'severity:error',
        statsPeriod: '24h',
      }),
    }).query;

    expect(relativeQuery.statsPeriod).toBe('24h');
    expect(relativeQuery.start).toBeUndefined();
    expect(relativeQuery.end).toBeUndefined();
    expect(relativeQuery.utc).toBeUndefined();
    expect(relativeQuery.period).toBeUndefined();
    expect(relativeQuery.pageStart).toBeUndefined();
    expect(relativeQuery.pageEnd).toBeUndefined();
    expect(relativeQuery.pageStatsPeriod).toBeUndefined();
    expect(relativeQuery.pageUtc).toBeUndefined();

    const absoluteQuery = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({
        statsPeriod: '7d',
        period: '14d',
        pageStart: '2024-05-01T00:00:00.000Z',
        pageEnd: '2024-05-02T00:00:00.000Z',
        pageStatsPeriod: '30d',
        pageUtc: 'false',
      }),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      result: seerResult({
        end: '2024-06-02T00:00:00Z',
        start: '2024-06-01T00:00:00Z',
      }),
    }).query;

    expect(absoluteQuery.start).toBe('2024-06-01T00:00:00');
    expect(absoluteQuery.end).toBe('2024-06-02T00:00:00');
    expect(absoluteQuery.statsPeriod).toBeUndefined();
    expect(absoluteQuery.period).toBeUndefined();
    expect(absoluteQuery.pageStart).toBeUndefined();
    expect(absoluteQuery.pageEnd).toBeUndefined();
    expect(absoluteQuery.pageStatsPeriod).toBeUndefined();
    expect(absoluteQuery.pageUtc).toBeUndefined();
  });

  it('clears absolute datetime params when Seer returns a stats period', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({
        end: '2024-01-02T00:00:00',
        start: '2024-01-01T00:00:00',
        utc: 'false',
      }),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime: {
        start: '2024-01-01T00:00:00',
        end: '2024-01-02T00:00:00',
        period: null,
        utc: false,
      },
      result: seerResult({
        end: '2024-06-02T00:00:00Z',
        start: '2024-06-01T00:00:00Z',
        statsPeriod: '24h',
      }),
    });

    expect(query.statsPeriod).toBe('24h');
    expect(query.start).toBeUndefined();
    expect(query.end).toBeUndefined();
    expect(query.utc).toBeUndefined();
  });

  it('preserves the current aggregate visualization when Seer omits one', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({}),
      currentAggregateFields: [
        {groupBy: 'severity'},
        new VisualizeFunction('count(message)', {chartType: ChartType.LINE}),
      ],
      pageDatetime,
      result: seerResult({
        mode: 'aggregates',
        groupBys: ['service.name'],
        sort: '-count(message)',
      }),
    });

    expect(aggregateFields(query)).toEqual([
      {groupBy: 'service.name'},
      {chartType: ChartType.LINE, yAxes: ['count(message)']},
    ]);
  });

  it('applies expanded project ids returned by Seer', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({}),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      result: seerResult({
        query: 'severity:error',
        expandedProjectIds: [1, 2],
      }),
    });

    expect(query.project).toEqual(['1', '2']);
  });

  it('leaves project filter untouched when Seer omits expanded project ids', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({project: ['7']}),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      result: seerResult({query: 'severity:error'}),
    });

    expect(query.project).toEqual(['7']);
  });

  it('moves a project filter from the query onto the project selector', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocation: locationWithQuery({}),
      currentAggregateFields: [new VisualizeFunction('count(message)')],
      pageDatetime,
      projects: [ProjectFixture({id: '9', slug: 'seer'})],
      result: seerResult({
        query: 'project:seer severity:error',
      }),
    });

    // Project scope goes to the page-level selector, not the search bar.
    expect(query.project).toEqual(['9']);
    expect(query.logsQuery).toBe('severity:error');
  });
});
