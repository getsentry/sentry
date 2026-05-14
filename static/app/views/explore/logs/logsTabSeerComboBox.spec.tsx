import type {Location} from 'history';

import {
  getLogsSeerLocationQuery,
  type AskSeerSearchQuery,
} from 'sentry/views/explore/logs/logsTabSeerComboBox';
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

describe('getLogsSeerLocationQuery', () => {
  it('applies raw logs response without aggregate visualization params', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocationQuery: {},
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
      currentLocationQuery: {},
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
      currentLocationQuery: {},
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

  it('orders grouped aggregate fields before returned visualizations', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocationQuery: {},
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
      {groupBy: 'service.name'},
      {groupBy: 'environment'},
      {chartType: ChartType.AREA, yAxes: ['p95(payload_size)']},
    ]);
  });

  it('preserves the current aggregate visualization when Seer omits one', () => {
    const {query} = getLogsSeerLocationQuery({
      currentLocationQuery: {},
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
});
