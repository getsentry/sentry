import type {AskSeerSearchQuery} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {getSeerExploreQuery, getSeerSort} from 'sentry/views/explore/seerQuery';
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
