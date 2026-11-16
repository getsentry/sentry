import qs from 'query-string';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {Mode} from 'sentry/views/explore/queryParams/mode';

import {NONE_UNIT} from './constants';
import {decodeMetricsQueryParams} from './metricQuery';
import {
  createTraceMetricEventsFilter,
  getAggregatesMetricsTotalFilter,
  getEquationMetricsTotalFilter,
  getMetricsUrlFromSavedQueryUrl,
  mapMetricUnitToFieldType,
  parseTraceMetricFromQuery,
  stripTraceMetricTokens,
} from './utils';

describe('mapMetricUnitToFieldType', () => {
  it.each([
    ['millisecond', {fieldType: 'duration', unit: 'millisecond'}],
    ['nanosecond', {fieldType: 'duration', unit: 'nanosecond'}],
    ['second', {fieldType: 'duration', unit: 'second'}],
    ['minute', {fieldType: 'duration', unit: 'minute'}],
    ['byte', {fieldType: 'size', unit: 'byte'}],
    ['kibibyte', {fieldType: 'size', unit: 'kibibyte'}],
    ['megabyte', {fieldType: 'size', unit: 'megabyte'}],
    ['ratio', {fieldType: 'percentage', unit: 'ratio'}],
    ['percent', {fieldType: 'percentage', unit: 'percent'}],
    [undefined, {fieldType: 'number', unit: undefined}],
    ['-', {fieldType: 'number', unit: undefined}],
    ['custom_unit', {fieldType: 'number', unit: undefined}],
  ])('maps %s to the correct field type', (unit, expected) => {
    expect(mapMetricUnitToFieldType(unit)).toEqual(expected);
  });
});

describe('parseTraceMetricFromQuery', () => {
  it('splits the metric identity from the remaining predicate', () => {
    expect(
      parseTraceMetricFromQuery(
        'metric.name:foo.duration metric.type:distribution metric.unit:millisecond value:>100'
      )
    ).toEqual({
      metric: {name: 'foo.duration', type: 'distribution', unit: 'millisecond'},
      rest: 'value:>100',
    });
  });

  it('defaults the unit to NONE_UNIT when absent', () => {
    expect(
      parseTraceMetricFromQuery('metric.name:foo.duration metric.type:counter')
    ).toEqual({
      metric: {name: 'foo.duration', type: 'counter', unit: NONE_UNIT},
      rest: '',
    });
  });

  it.each([
    ['value:>100'],
    ['metric.name:foo.duration value:>100'],
    ['metric.name:foo.duration metric.type:bogus'],
  ])('returns no metric and leaves %s untouched', query => {
    expect(parseTraceMetricFromQuery(query)).toEqual({metric: undefined, rest: query});
  });
});

describe('stripTraceMetricTokens', () => {
  it.each([
    ['metric.name:foo metric.type:distribution metric.unit:ms value:>100', 'value:>100'],
    // Incomplete identity (missing metric.type) is still stripped — the case where
    // the metric came from the visualization aggregate but a stale metric.name
    // token lingered in the query.
    ['metric.name:foo value:>100', 'value:>100'],
    ['value:>100', 'value:>100'],
  ])('strips metric tokens from %s', (query, expected) => {
    expect(stripTraceMetricTokens(query)).toBe(expected);
  });
});

describe('getMetricsUrlFromSavedQueryUrl', () => {
  const organization = OrganizationFixture();

  function decodeMetricFromUrl(url: string) {
    const query = qs.parseUrl(url).query;
    const metricParam = Array.isArray(query.metric) ? query.metric[0] : query.metric;
    return decodeMetricsQueryParams(metricParam!);
  }

  it('decodes orderby into sortBys for new-format queries', () => {
    const url = getMetricsUrlFromSavedQueryUrl({
      organization,
      savedQuery: new SavedQuery({
        id: 1,
        interval: '5m',
        name: 'test query',
        projects: [],
        dataset: 'metrics',
        dateAdded: '2025-01-01T00:00:00.000000Z',
        dateUpdated: '2025-01-01T00:00:00.000000Z',
        lastVisited: '2025-01-01T00:00:00.000000Z',
        starred: false,
        position: null,
        query: [
          {
            mode: Mode.SAMPLES,
            query: '',
            fields: ['id', 'timestamp'],
            orderby: '-value',
            aggregateOrderby: '-sum(value,test_metric,counter,none)',
            aggregateField: [{yAxes: ['sum(value,test_metric,counter,none)']}],
            metric: {name: 'test_metric', type: 'counter'},
          },
        ],
      }),
    });

    const decoded = decodeMetricFromUrl(url);
    expect(decoded?.queryParams.sortBys).toEqual([{field: 'value', kind: 'desc'}]);
  });

  it('decodes aggregateOrderby into aggregateSortBys', () => {
    const url = getMetricsUrlFromSavedQueryUrl({
      organization,
      savedQuery: new SavedQuery({
        id: 1,
        interval: '5m',
        name: 'test query',
        projects: [],
        dataset: 'metrics',
        dateAdded: '2025-01-01T00:00:00.000000Z',
        dateUpdated: '2025-01-01T00:00:00.000000Z',
        lastVisited: '2025-01-01T00:00:00.000000Z',
        starred: false,
        position: null,
        query: [
          {
            mode: Mode.SAMPLES,
            query: '',
            fields: ['id', 'timestamp'],
            orderby: '-timestamp',
            aggregateOrderby: '-sum(value,test_metric,counter,none)',
            aggregateField: [{yAxes: ['sum(value,test_metric,counter,none)']}],
            metric: {name: 'test_metric', type: 'counter'},
          },
        ],
      }),
    });

    const decoded = decodeMetricFromUrl(url);
    expect(decoded?.queryParams.sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);
    expect(decoded?.queryParams.aggregateSortBys).toEqual([
      {field: 'sum(value,test_metric,counter,none)', kind: 'desc'},
    ]);
  });

  it('falls back to legacy orderby when aggregateOrderby is missing (backwards compat)', () => {
    const url = getMetricsUrlFromSavedQueryUrl({
      organization,
      savedQuery: new SavedQuery({
        id: 1,
        interval: '5m',
        name: 'test query',
        projects: [],
        dataset: 'metrics',
        dateAdded: '2025-01-01T00:00:00.000000Z',
        dateUpdated: '2025-01-01T00:00:00.000000Z',
        lastVisited: '2025-01-01T00:00:00.000000Z',
        starred: false,
        position: null,
        query: [
          {
            mode: Mode.SAMPLES,
            query: '',
            fields: ['id', 'timestamp'],
            orderby: '-sum(value,test_metric,counter,none)',
            aggregateField: [{yAxes: ['sum(value,test_metric,counter,none)']}],
            metric: {name: 'test_metric', type: 'counter'},
          },
        ],
      }),
    });

    const decoded = decodeMetricFromUrl(url);
    expect(decoded?.queryParams.sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);
    expect(decoded?.queryParams.aggregateSortBys).toEqual([
      {field: 'sum(value,test_metric,counter,none)', kind: 'desc'},
    ]);
  });

  it('does not reuse legacy aggregate timestamp orderby as sample sort', () => {
    const url = getMetricsUrlFromSavedQueryUrl({
      organization,
      savedQuery: new SavedQuery({
        id: 1,
        interval: '5m',
        name: 'test query',
        projects: [],
        dataset: 'metrics',
        dateAdded: '2025-01-01T00:00:00.000000Z',
        dateUpdated: '2025-01-01T00:00:00.000000Z',
        lastVisited: '2025-01-01T00:00:00.000000Z',
        starred: false,
        position: null,
        query: [
          {
            mode: Mode.SAMPLES,
            query: '',
            fields: ['id', 'timestamp'],
            orderby: 'timestamp',
            aggregateField: [
              {yAxes: ['sum(value,test_metric,counter,none)']},
              {groupBy: 'timestamp'},
            ],
            metric: {name: 'test_metric', type: 'counter'},
          },
        ],
      }),
    });

    const decoded = decodeMetricFromUrl(url);
    expect(decoded?.queryParams.sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);
    expect(decoded?.queryParams.aggregateSortBys).toEqual([
      {field: 'timestamp', kind: 'asc'},
    ]);
  });

  it('treats empty aggregateOrderby as new-format and preserves sample sort', () => {
    const url = getMetricsUrlFromSavedQueryUrl({
      organization,
      savedQuery: new SavedQuery({
        id: 1,
        interval: '5m',
        name: 'test query',
        projects: [],
        dataset: 'metrics',
        dateAdded: '2025-01-01T00:00:00.000000Z',
        dateUpdated: '2025-01-01T00:00:00.000000Z',
        lastVisited: '2025-01-01T00:00:00.000000Z',
        starred: false,
        position: null,
        query: [
          {
            mode: Mode.SAMPLES,
            query: '',
            fields: ['id', 'timestamp'],
            orderby: '-value',
            aggregateOrderby: '',
            aggregateField: [{yAxes: ['sum(value,test_metric,counter,none)']}],
            metric: {name: 'test_metric', type: 'counter'},
          },
        ],
      }),
    });

    const decoded = decodeMetricFromUrl(url);
    expect(decoded?.queryParams.sortBys).toEqual([{field: 'value', kind: 'desc'}]);
    expect(decoded?.queryParams.aggregateSortBys).toEqual([
      {field: 'sum(value,test_metric,counter,none)', kind: 'desc'},
    ]);
  });

  it('falls back to defaults when orderby is missing', () => {
    const url = getMetricsUrlFromSavedQueryUrl({
      organization,
      savedQuery: new SavedQuery({
        id: 1,
        interval: '5m',
        name: 'test query',
        projects: [],
        dataset: 'metrics',
        dateAdded: '2025-01-01T00:00:00.000000Z',
        dateUpdated: '2025-01-01T00:00:00.000000Z',
        lastVisited: '2025-01-01T00:00:00.000000Z',
        starred: false,
        position: null,
        query: [
          {
            mode: Mode.SAMPLES,
            query: '',
            fields: ['id', 'timestamp'],
            orderby: '',
            aggregateField: [{yAxes: ['sum(value,test_metric,counter,none)']}],
            metric: {name: 'test_metric', type: 'counter'},
          },
        ],
      }),
    });

    const decoded = decodeMetricFromUrl(url);
    expect(decoded?.queryParams.sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);
  });
});

describe('getEquationMetricsTotalFilter', () => {
  it('returns the correct filter for an equation', () => {
    const equation =
      'equation|sum(value,metricA,counter,none) + count(value,metricB,distribution,millisecond)';
    const result = getEquationMetricsTotalFilter(equation);
    expect(result).toBe(
      '( metric.name:metricA metric.type:counter ( !has:metric.unit OR metric.unit:none ) ) OR ( metric.name:metricB metric.type:distribution metric.unit:millisecond )'
    );
  });

  it('returns an empty string when provided a non-equation', () => {
    const equation = 'i dont know what this is';
    const result = getEquationMetricsTotalFilter(equation);
    expect(result).toBe('');
  });

  it('works with equations that have _if conditions', () => {
    const equation =
      'equation|sum_if(`status:[ok,error]`,value,metricA,counter,none) + sum_if(`status:error`,value,metricB,counter,none)';
    const result = getEquationMetricsTotalFilter(equation);
    expect(result).toBe(
      '( metric.name:metricA metric.type:counter ( !has:metric.unit OR metric.unit:none ) ) OR ( metric.name:metricB metric.type:counter ( !has:metric.unit OR metric.unit:none ) )'
    );
  });

  it('does not filter by unit for aggregates with a dash unit', () => {
    const equation =
      'equation|sum(value,metricA,counter,-) + count(value,metricB,distribution,millisecond)';
    const result = getEquationMetricsTotalFilter(equation);
    expect(result).toBe(
      '( metric.name:metricA metric.type:counter ) OR ( metric.name:metricB metric.type:distribution metric.unit:millisecond )'
    );
  });
});

describe('getAggregatesMetricsTotalFilter', () => {
  it('does not filter by unit when an aggregate has a dash unit', () => {
    const result = getAggregatesMetricsTotalFilter([
      'p50(value,my_metric,distribution,-)',
    ]);

    expect(result).toBe('( metric.name:my_metric metric.type:distribution )');
  });

  it('merges identical filters when aggregates read the same metric', () => {
    const result = getAggregatesMetricsTotalFilter([
      'p50(value,my_metric,distribution,millisecond)',
      'p95(value,my_metric,distribution,millisecond)',
    ]);

    expect(result).toBe(
      '( metric.name:my_metric metric.type:distribution metric.unit:millisecond )'
    );
  });

  it('does not filter by unit when an _if aggregate has a dash unit', () => {
    const result = getAggregatesMetricsTotalFilter([
      'sum_if(`status:error`,value,metricA,counter,-)',
    ]);

    expect(result).toBe('( metric.name:metricA metric.type:counter )');
  });

  it('filters by unit when aggregates have none or a specific unit', () => {
    const result = getAggregatesMetricsTotalFilter([
      'sum(value,metricA,counter,none)',
      'avg(value,metricB,distribution,millisecond)',
    ]);

    expect(result).toBe(
      '( metric.name:metricA metric.type:counter ( !has:metric.unit OR metric.unit:none ) ) OR ( metric.name:metricB metric.type:distribution metric.unit:millisecond )'
    );
  });

  it('skips aggregates that do not name a trace metric', () => {
    const result = getAggregatesMetricsTotalFilter([
      'count()',
      'avg(value,metricB,distribution,millisecond)',
    ]);

    expect(result).toBe(
      '( metric.name:metricB metric.type:distribution metric.unit:millisecond )'
    );
  });
});

describe('createTraceMetricEventsFilter', () => {
  it('matches both !has:metric.unit and metric.unit:none when unit is absent', () => {
    const result = createTraceMetricEventsFilter([
      {name: 'chat.message_sent', type: 'counter'},
    ]);

    expect(result).toBe(
      '( metric.name:chat.message_sent metric.type:counter ( !has:metric.unit OR metric.unit:none ) )'
    );
  });

  it('treats the legacy dash unit sentinel as no unit', () => {
    const result = createTraceMetricEventsFilter([
      {name: 'chat.message_sent', type: 'counter', unit: '-'},
    ]);

    expect(result).toBe(
      '( metric.name:chat.message_sent metric.type:counter ( !has:metric.unit OR metric.unit:none ) )'
    );
  });
});
