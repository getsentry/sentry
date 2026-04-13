import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  decodeMetricsQueryParams,
  defaultMetricQuery,
  encodeMetricQueryParams,
} from 'sentry/views/explore/metrics/metricQuery';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

describe('decodeMetricsQueryParams', () => {
  it('parses all visualizes', () => {
    const json = JSON.stringify({
      metric: {name: 'test_metric', type: 'distribution'},
      query: '',
      aggregateFields: [
        {yAxes: ['p50(value,test_metric,distribution,-)']},
        {yAxes: ['p75(value,test_metric,distribution,-)']},
        {yAxes: ['p99(value,test_metric,distribution,-)']},
      ],
      aggregateSortBys: [],
      mode: 'samples',
    });

    const result = decodeMetricsQueryParams(json);

    expect(result?.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('p50(value,test_metric,distribution,-)'),
      new VisualizeFunction('p75(value,test_metric,distribution,-)'),
      new VisualizeFunction('p99(value,test_metric,distribution,-)'),
    ]);
  });

  it('returns null for invalid JSON', () => {
    const result = decodeMetricsQueryParams('invalid json');
    expect(result).toBeNull();
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
        {yAxes: ['p50(value,test_metric,distribution,-)']},
        {yAxes: ['p75(value,test_metric,distribution,-)']},
        {groupBy: 'environment'},
      ],
      aggregateSortBys: [],
      mode: 'samples',
    });

    const result = decodeMetricsQueryParams(json);

    expect(result?.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('p50(value,test_metric,distribution,-)'),
      new VisualizeFunction('p75(value,test_metric,distribution,-)'),
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
          new VisualizeFunction('per_second(value,test_metric,counter,-)'),
          new VisualizeFunction('sum(value,test_metric,counter,-)'),
        ],
        aggregateSortBys: [
          {field: 'per_second(value,test_metric,counter,-)', kind: 'desc'},
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
        aggregateFields: [new VisualizeFunction('sum(value,test_metric,counter,-)')],
        aggregateSortBys: [
          {field: 'sum(value,test_metric,counter,-)', kind: 'desc' as const},
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
      aggregateFields: [{yAxes: ['sum(value,test_metric,counter,-)']}],
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
      aggregateFields: [{yAxes: ['sum(value,test_metric,counter,-)']}],
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
      aggregateFields: [{yAxes: ['sum(value,test_metric,counter,-)']}],
      aggregateSortBys: [],
      sortBys: [{field: 'value', kind: 'invalid'}],
      mode: 'samples',
    });

    const result = decodeMetricsQueryParams(json);

    expect(result?.queryParams.sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);
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
        mode: Mode.SAMPLES,
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
