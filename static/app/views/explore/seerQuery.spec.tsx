import type {AskSeerSearchQuery} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {
  getSeerExploreQuery,
  getSeerSort,
  getSeerWritableAggregateFields,
} from 'sentry/views/explore/seerQuery';
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
    mode: 'samples',
    visualizations: [],
    ...overrides,
  };
}

describe('getSeerExploreQuery', () => {
  it('normalizes mode, datetime, and visualizes', () => {
    const result = getSeerExploreQuery({
      pageDatetime,
      result: seerResult({
        query: 'span.op:db',
        sort: '-timestamp',
        groupBys: ['project'],
        mode: 'samples',
        statsPeriod: '24h',
        visualizations: [{chartType: ChartType.BAR, yAxes: ['count()']}],
      }),
    });

    expect(result).toMatchObject({
      query: 'span.op:db',
      sort: '-timestamp',
      groupBys: ['project'],
      mode: 'aggregate',
      datetime: {period: '24h'},
      visualizes: [{chartType: ChartType.BAR, yAxes: ['count()']}],
    });
  });

  it('keeps Seer relative datetime mutually exclusive from absolute ranges', () => {
    const result = getSeerExploreQuery({
      pageDatetime: {
        start: '2024-01-01T00:00:00',
        end: '2024-01-02T00:00:00',
        period: null,
        utc: false,
      },
      result: seerResult({
        start: '2024-06-01T00:00:00Z',
        end: '2024-06-02T00:00:00Z',
        statsPeriod: '24h',
      }),
    });

    expect(result.datetime).toEqual({
      start: null,
      end: null,
      period: '24h',
      utc: null,
    });
  });

  it('passes through the interval', () => {
    const result = getSeerExploreQuery({
      pageDatetime,
      result: seerResult({interval: '1h'}),
    });

    expect(result.interval).toBe('1h');
  });

  it('leaves interval undefined when none is provided', () => {
    const result = getSeerExploreQuery({
      pageDatetime,
      result: seerResult({}),
    });

    expect(result.interval).toBeUndefined();
  });
});

describe('getSeerSort', () => {
  it('parses descending and ascending sorts', () => {
    expect(getSeerSort('-count()')).toEqual({field: 'count()', kind: 'desc'});
    expect(getSeerSort('timestamp')).toEqual({field: 'timestamp', kind: 'asc'});
    expect(getSeerSort('')).toBeUndefined();
  });
});

describe('getSeerWritableAggregateFields', () => {
  it('uses Seer groupBys and visualizes when present', () => {
    expect(
      getSeerWritableAggregateFields({
        currentAggregateFields: [new VisualizeFunction('count(message)')],
        groupBys: ['service.name'],
        visualizes: [{chartType: ChartType.AREA, yAxes: ['p95(payload_size)']}],
      })
    ).toEqual([
      {groupBy: 'service.name'},
      {chartType: ChartType.AREA, yAxes: ['p95(payload_size)']},
    ]);
  });

  it('preserves visualize-first aggregate field order', () => {
    expect(
      getSeerWritableAggregateFields({
        currentAggregateFields: [
          new VisualizeFunction('count(message)'),
          {groupBy: 'severity'},
        ],
        groupBys: ['service.name', 'environment'],
        visualizes: [{chartType: ChartType.AREA, yAxes: ['p95(payload_size)']}],
      })
    ).toEqual([
      {chartType: ChartType.AREA, yAxes: ['p95(payload_size)']},
      {groupBy: 'service.name'},
      {groupBy: 'environment'},
    ]);
  });

  it('preserves mixed aggregate field order when groupBys straddle visualizes', () => {
    expect(
      getSeerWritableAggregateFields({
        currentAggregateFields: [
          {groupBy: 'severity'},
          new VisualizeFunction('count(message)'),
          {groupBy: 'project'},
        ],
        groupBys: ['service.name', 'environment'],
        visualizes: [{chartType: ChartType.AREA, yAxes: ['p95(payload_size)']}],
      })
    ).toEqual([
      {groupBy: 'service.name'},
      {chartType: ChartType.AREA, yAxes: ['p95(payload_size)']},
      {groupBy: 'environment'},
    ]);
  });

  it('falls back to existing visualizes, then default visualizes', () => {
    expect(
      getSeerWritableAggregateFields({
        currentAggregateFields: [
          {groupBy: 'severity'},
          new VisualizeFunction('count(message)', {chartType: ChartType.LINE}),
        ],
        groupBys: ['service.name'],
        visualizes: [],
      })
    ).toEqual([
      {groupBy: 'service.name'},
      {chartType: ChartType.LINE, yAxes: ['count(message)']},
    ]);

    expect(
      getSeerWritableAggregateFields({
        currentAggregateFields: [],
        fallbackVisualizes: [{yAxes: ['count(message)']}],
        groupBys: [],
        visualizes: [],
      })
    ).toEqual([{yAxes: ['count(message)']}]);
  });
});
