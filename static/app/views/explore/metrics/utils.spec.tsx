import qs from 'query-string';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {SavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {NONE_UNIT} from 'sentry/views/explore/metrics/constants';
import {
  type BaseMetricQuery,
  decodeMetricsQueryParams,
  defaultMetricQuery,
  encodeMetricQueryParams,
} from 'sentry/views/explore/metrics/metricQuery';
import {
  createTraceMetricEventsFilter,
  encodeEquationMetricQueries,
  getEquationMetricsTotalFilter,
  getMetricsUrlFromSavedQueryUrl,
  mapMetricUnitToFieldType,
  parseTraceMetricFromQuery,
  spliceEquationQueries,
  stripTraceMetricTokens,
} from 'sentry/views/explore/metrics/utils';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {VisualizeEquation} from 'sentry/views/explore/queryParams/visualize';

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

function makeAggregateQuery(overrides?: Partial<BaseMetricQuery>): BaseMetricQuery {
  return {
    ...defaultMetricQuery(),
    metric: {name: 'test_metric', type: 'counter'},
    ...overrides,
  };
}

function makeEquationQuery(equation: string): BaseMetricQuery {
  return {
    ...defaultMetricQuery({type: 'equation'}),
    queryParams: defaultMetricQuery({type: 'equation'}).queryParams.replace({
      aggregateFields: [new VisualizeEquation(`${EQUATION_PREFIX}${equation}`)],
    }),
  };
}

describe('spliceEquationQueries', () => {
  it('returns noop when equationMetricQueries is empty', () => {
    const encoded = ['a', 'b'];
    const result = spliceEquationQueries(encoded, []);
    expect(result).toBe('noop');
    expect(encoded).toEqual(['a', 'b']);
  });

  it('returns requires_clear when there are not enough slots', () => {
    const existingEncoded = Array.from({length: 8}, (_, i) => `metric_${i}`);
    const equationQueries = [makeAggregateQuery(), makeEquationQuery('a + b')];

    const result = spliceEquationQueries(existingEncoded, equationQueries);
    expect(result).toBe('requires_clear');
    expect(existingEncoded).toHaveLength(8);
  });

  it('splices aggregate rows before existing equations and appends equation rows', () => {
    const existingAggregate = makeAggregateQuery();
    const existingEquation = makeEquationQuery('a + b');

    const existingMetrics = [existingAggregate, existingEquation];
    const encodedMetrics = existingMetrics.map(mq => encodeMetricQueryParams(mq));

    const newAgg = makeAggregateQuery({
      metric: {name: 'new_agg', type: 'distribution'},
    });
    const newEqn = makeEquationQuery('c + d');

    const result = spliceEquationQueries(encodedMetrics, [newAgg, newEqn]);

    expect(result).toBe('applied');
    expect(encodedMetrics).toHaveLength(4);
    expect(encodedMetrics[1]).toBe(encodeMetricQueryParams(newAgg));
    expect(encodedMetrics[3]).toBe(encodeMetricQueryParams(newEqn));
  });

  it('appends aggregates at the end when no existing equations', () => {
    const existingAggregate = makeAggregateQuery();
    const existingMetrics = [existingAggregate];
    const encodedMetrics = existingMetrics.map(mq => encodeMetricQueryParams(mq));

    const newAgg = makeAggregateQuery({
      metric: {name: 'new_metric', type: 'gauge'},
    });

    const result = spliceEquationQueries(encodedMetrics, [newAgg]);

    expect(result).toBe('applied');
    expect(encodedMetrics).toHaveLength(2);
    expect(encodedMetrics[1]).toBe(encodeMetricQueryParams(newAgg));
  });
});

describe('encodeEquationMetricQueries', () => {
  it('returns encoded aggregates before equations', () => {
    const agg = makeAggregateQuery({metric: {name: 'metricA', type: 'counter'}});
    const eqn = makeEquationQuery('metricA + metricB');

    const result = encodeEquationMetricQueries([eqn, agg]);

    expect(result).toEqual([encodeMetricQueryParams(agg), encodeMetricQueryParams(eqn)]);
  });

  it('returns empty array for empty input', () => {
    expect(encodeEquationMetricQueries([])).toEqual([]);
  });

  it('handles multiple aggregates and one equation', () => {
    const agg1 = makeAggregateQuery({metric: {name: 'metricA', type: 'counter'}});
    const agg2 = makeAggregateQuery({metric: {name: 'metricB', type: 'distribution'}});
    const eqn = makeEquationQuery('metricA / metricB');

    const result = encodeEquationMetricQueries([eqn, agg1, agg2]);

    expect(result).toEqual([
      encodeMetricQueryParams(agg1),
      encodeMetricQueryParams(agg2),
      encodeMetricQueryParams(eqn),
    ]);
  });
});
