import {LocationFixture} from 'sentry-fixture/locationFixture';

import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

import {
  decodeMetricsQueryParams,
  defaultMetricQuery,
  encodeMetricQueryParams,
  stripMetricParamsFromLocation,
} from './metricQuery';

describe('decodeMetricsQueryParams', () => {
  it('parses all visualizes', () => {
    const json = JSON.stringify({
      metric: {name: 'test_metric', type: 'distribution'},
      query: '',
      aggregateFields: [
        {yAxes: ['p50(value,test_metric,distribution,none)']},
        {yAxes: ['p75(value,test_metric,distribution,none)']},
        {yAxes: ['p99(value,test_metric,distribution,none)']},
      ],
      aggregateSortBys: [],
      mode: 'samples',
    });

    const result = decodeMetricsQueryParams(json);

    expect(result?.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('p50(value,test_metric,distribution,none)'),
      new VisualizeFunction('p75(value,test_metric,distribution,none)'),
      new VisualizeFunction('p99(value,test_metric,distribution,none)'),
    ]);
  });

  it('returns null when metric is missing', () => {
    const json = JSON.stringify({
      query: '',
      aggregateFields: [{yAxes: ['p50(value)']}],
      aggregateSortBys: [],
      mode: 'samples',
    });

    const result = decodeMetricsQueryParams(json);
    expect(result).toBeNull();
  });

  it('returns null when no visualizes are found', () => {
    const json = JSON.stringify({
      metric: {name: 'test_metric', type: 'distribution'},
      query: '',
      aggregateFields: [],
      aggregateSortBys: [],
      mode: 'samples',
    });

    const result = decodeMetricsQueryParams(json);
    expect(result).toBeNull();
  });

  it('handles groupBys correctly', () => {
    const json = JSON.stringify({
      metric: {name: 'test_metric', type: 'distribution'},
      query: '',
      aggregateFields: [
        {yAxes: ['p50(value,test_metric,distribution,none)']},
        {yAxes: ['p75(value,test_metric,distribution,none)']},
        {groupBy: 'environment'},
      ],
      aggregateSortBys: [],
      mode: 'samples',
    });

    const result = decodeMetricsQueryParams(json);

    expect(result?.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('p50(value,test_metric,distribution,none)'),
      new VisualizeFunction('p75(value,test_metric,distribution,none)'),
      {groupBy: 'environment'},
    ]);
  });

  it('round-trips encode/decode', () => {
    const original = {
      metric: {name: 'test_metric', type: 'counter'},
      queryParams: new ReadableQueryParams({
        extrapolate: true,
        mode: Mode.SAMPLES,
        query: 'has:environment',
        cursor: '',
        fields: ['id', 'timestamp'],
        sortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateCursor: '',
        aggregateFields: [
          new VisualizeFunction('per_second(value,test_metric,counter,none)'),
          new VisualizeFunction('sum(value,test_metric,counter,none)'),
        ],
        aggregateSortBys: [
          {field: 'per_second(value,test_metric,counter,none)', kind: 'desc'},
        ],
      }),
    };

    const encoded = encodeMetricQueryParams(original);
    const decoded = decodeMetricsQueryParams(encoded);

    expect(decoded?.metric).toEqual(original.metric);
    expect(decoded?.queryParams.aggregateFields).toEqual(
      original.queryParams.aggregateFields
    );
    expect(decoded?.queryParams.sortBys).toEqual(original.queryParams.sortBys);
  });

  it('round-trips custom sortBys through encode/decode', () => {
    const original = {
      metric: {name: 'test_metric', type: 'counter'},
      queryParams: new ReadableQueryParams({
        extrapolate: true,
        mode: Mode.SAMPLES,
        query: '',
        cursor: '',
        fields: ['id', 'timestamp'],
        sortBys: [{field: 'value', kind: 'asc' as const}],
        aggregateCursor: '',
        aggregateFields: [new VisualizeFunction('sum(value,test_metric,counter,none)')],
        aggregateSortBys: [
          {field: 'sum(value,test_metric,counter,none)', kind: 'desc' as const},
        ],
      }),
    };

    const encoded = encodeMetricQueryParams(original);
    const decoded = decodeMetricsQueryParams(encoded);

    expect(decoded?.queryParams.sortBys).toEqual([{field: 'value', kind: 'asc'}]);
  });

  it('falls back to default sortBys when missing from JSON', () => {
    const json = JSON.stringify({
      metric: {name: 'test_metric', type: 'counter'},
      query: '',
      aggregateFields: [{yAxes: ['sum(value,test_metric,counter,none)']}],
      aggregateSortBys: [],
      mode: 'samples',
    });

    const result = decodeMetricsQueryParams(json);

    expect(result?.queryParams.sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);
  });

  it('falls back to default sortBys when field is not sortable', () => {
    const json = JSON.stringify({
      metric: {name: 'test_metric', type: 'counter'},
      query: '',
      aggregateFields: [{yAxes: ['sum(value,test_metric,counter,none)']}],
      aggregateSortBys: [],
      sortBys: [{field: 'arbitrary_field', kind: 'desc'}],
      mode: 'samples',
    });

    const result = decodeMetricsQueryParams(json);

    expect(result?.queryParams.sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);
  });

  it('falls back to default sortBys when format is invalid', () => {
    const json = JSON.stringify({
      metric: {name: 'test_metric', type: 'counter'},
      query: '',
      aggregateFields: [{yAxes: ['sum(value,test_metric,counter,none)']}],
      aggregateSortBys: [],
      sortBys: [{field: 'value', kind: 'invalid'}],
      mode: 'samples',
    });

    const result = decodeMetricsQueryParams(json);

    expect(result?.queryParams.sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);
  });

  it('falls back to default sortBys when only some items are valid', () => {
    const json = JSON.stringify({
      metric: {name: 'test_metric', type: 'counter'},
      aggregateFields: [{yAxes: ['sum(value,test_metric,counter,none)']}],
      sortBys: [
        {field: 'value', kind: 'asc'},
        {field: 'arbitrary_field', kind: 'asc'},
      ],
    });

    const result = decodeMetricsQueryParams(json);

    expect(result?.queryParams.sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);
  });

  it.each([
    'invalid json',
    'null',
    '[]',
    '"metric"',
    JSON.stringify({metric: 'test_metric', query: ''}),
  ])('returns null and warns when the param is %s', value => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = decodeMetricsQueryParams(value);

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      '[decodeMetricsQueryParams] Failed to parse metric URL param:',
      value
    );
  });

  it('returns null when aggregateFields is not an array', () => {
    const json = JSON.stringify({
      metric: {name: 'test_metric', type: 'counter'},
      aggregateFields: {yAxes: ['sum(value,test_metric,counter,none)']},
    });

    const result = decodeMetricsQueryParams(json);

    expect(result).toBeNull();
  });

  it('defaults query, mode, and sorts when they are missing', () => {
    const json = JSON.stringify({
      metric: {name: 'test_metric', type: 'counter'},
      aggregateFields: [{yAxes: ['sum(value,test_metric,counter,none)']}],
    });

    const result = decodeMetricsQueryParams(json);

    expect(result?.queryParams).toEqual(
      new ReadableQueryParams({
        extrapolate: true,
        mode: Mode.SAMPLES,
        query: '',
        cursor: '',
        fields: ['id', 'timestamp'],
        sortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateCursor: '',
        aggregateFields: [new VisualizeFunction('sum(value,test_metric,counter,none)')],
        aggregateSortBys: [{field: 'sum(value,test_metric,counter,none)', kind: 'desc'}],
      })
    );
  });

  it.each([
    {query: 5, mode: 'AGGREGATE'},
    {query: null, mode: null},
  ])('defaults query and mode when they are $query and $mode', ({query, mode}) => {
    const json = JSON.stringify({
      metric: {name: 'test_metric', type: 'counter'},
      query,
      aggregateFields: [{yAxes: ['sum(value,test_metric,counter,none)']}],
      mode,
    });

    const result = decodeMetricsQueryParams(json);

    expect(result?.queryParams.query).toBe('');
    expect(result?.queryParams.mode).toBe(Mode.SAMPLES);
  });

  it('filters out invalid aggregateFields items', () => {
    const json = JSON.stringify({
      metric: {name: 'test_metric', type: 'counter'},
      aggregateFields: [
        null,
        'sum(value,test_metric,counter,none)',
        {yAxes: [5]},
        {yAxes: ['avg(value,test_metric,counter,none)'], chartType: 99},
        {groupBy: 5},
        {yAxes: ['sum(value,test_metric,counter,none)']},
        {groupBy: 'environment'},
      ],
    });

    const result = decodeMetricsQueryParams(json);

    expect(result?.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('avg(value,test_metric,counter,none)'),
      new VisualizeFunction('sum(value,test_metric,counter,none)'),
      {groupBy: 'environment'},
    ]);
  });

  it('keeps aggregateSortBys and mode when they are valid', () => {
    const json = JSON.stringify({
      metric: {name: 'test_metric', type: 'counter'},
      aggregateFields: [
        {yAxes: ['sum(value,test_metric,counter,none)']},
        {groupBy: 'environment'},
      ],
      aggregateSortBys: [{field: 'environment', kind: 'asc'}],
      mode: 'aggregate',
    });

    const result = decodeMetricsQueryParams(json);

    expect(result?.queryParams.aggregateSortBys).toEqual([
      {field: 'environment', kind: 'asc'},
    ]);
    expect(result?.queryParams.mode).toBe(Mode.AGGREGATE);
  });

  it.each([
    ['not an array', {field: 'sum(value,test_metric,counter,none)', kind: 'asc'}],
    ['a list of strings', ['-sum(value,test_metric,counter,none)']],
    ['a list with null', [null]],
    [
      'a list with an item missing its kind',
      [{field: 'sum(value,test_metric,counter,none)'}],
    ],
    [
      'a list with an invalid kind',
      [{field: 'sum(value,test_metric,counter,none)', kind: 'up'}],
    ],
    ['a list with an unknown field', [{field: 'environment', kind: 'asc'}]],
  ])('falls back to default aggregateSortBys when it is %s', (_, aggregateSortBys) => {
    const json = JSON.stringify({
      metric: {name: 'test_metric', type: 'counter'},
      aggregateFields: [{yAxes: ['sum(value,test_metric,counter,none)']}],
      aggregateSortBys,
    });

    const result = decodeMetricsQueryParams(json);

    expect(result?.queryParams.aggregateSortBys).toEqual([
      {field: 'sum(value,test_metric,counter,none)', kind: 'desc'},
    ]);
  });

  it('round-trips extra keys on the metric, group bys, and sorts', () => {
    const value = JSON.stringify({
      metric: {name: 'test_metric', type: 'counter', unit: null, extra: 1},
      query: 'has:environment',
      aggregateFields: [
        {yAxes: ['sum(value,test_metric,counter,none)']},
        {groupBy: 'environment', extra: 2},
      ],
      aggregateSortBys: [{field: 'environment', kind: 'asc', extra: 3}],
      sortBys: [{field: 'value', kind: 'asc', extra: 4}],
      mode: 'aggregate',
    });

    const encoded = encodeMetricQueryParams(decodeMetricsQueryParams(value)!);

    expect(encoded).toBe(value);
  });
});

describe('defaultMetricQuery', () => {
  it('returns a default metric query', () => {
    const result = defaultMetricQuery();
    expect(result).toEqual({
      metric: {name: '', type: ''},
      queryParams: new ReadableQueryParams({
        extrapolate: true,
        mode: Mode.SAMPLES,
        query: '',
        cursor: '',
        fields: ['id', 'timestamp'],
        sortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateCursor: '',
        aggregateFields: [new VisualizeFunction('sum(value)')],
        aggregateSortBys: [{field: 'sum(value)', kind: 'desc'}],
      }),
    });
  });

  it('returns a default metric query with an equation', () => {
    const result = defaultMetricQuery({type: 'equation'});
    expect(result).toEqual({
      metric: {name: '', type: ''},
      queryParams: new ReadableQueryParams({
        extrapolate: true,
        mode: Mode.AGGREGATE,
        query: '',
        cursor: '',
        fields: ['id', 'timestamp'],
        sortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateCursor: '',
        aggregateFields: [new VisualizeEquation(EQUATION_PREFIX)],
        aggregateSortBys: [{field: EQUATION_PREFIX, kind: 'desc'}],
      }),
    });
  });
});

describe('stripMetricParamsFromLocation', () => {
  it('removes metric query params and keeps other params', () => {
    const location = LocationFixture({
      query: {
        metric: '{"metric":{"name":"foo","type":"counter"}}',
        id: '123',
        title: 'My Query',
        mode: 'aggregate',
        query: 'env:prod',
        project: '1',
        statsPeriod: '14d',
      },
    });

    const result = stripMetricParamsFromLocation(location);

    expect(result.query).toEqual({project: '1', statsPeriod: '14d'});
    expect(location.query.title).toBe('My Query');
  });
});
