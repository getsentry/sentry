import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  decodeMetricsQueryParams,
  encodeMetricQueryParams,
} from 'sentry/views/explore/metrics/metricQuery';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

describe('decodeMetricsQueryParams', () => {
  it('parses only first visualize when multiVisualize=false', () => {
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

    const result = decodeMetricsQueryParams(json, false);

    expect(result).not.toBeNull();
    expect(result?.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('p50(value,test_metric,distribution,-)'),
    ]);
  });

  it('parses all visualizes when multiVisualize=true', () => {
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

    const result = decodeMetricsQueryParams(json, true);

    expect(result).not.toBeNull();
    expect(result?.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('p50(value,test_metric,distribution,-)'),
      new VisualizeFunction('p75(value,test_metric,distribution,-)'),
      new VisualizeFunction('p99(value,test_metric,distribution,-)'),
    ]);
  });

  it('returns null for invalid JSON', () => {
    const result = decodeMetricsQueryParams('invalid json', false);
    expect(result).toBeNull();
  });

  it('returns null when metric is missing', () => {
    const json = JSON.stringify({
      query: '',
      aggregateFields: [{yAxes: ['p50(value)']}],
      aggregateSortBys: [],
      mode: 'samples',
    });

    const result = decodeMetricsQueryParams(json, false);
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

    const result = decodeMetricsQueryParams(json, false);
    expect(result).toBeNull();
  });

  it('handles groupBys correctly with multiVisualize', () => {
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

    const result = decodeMetricsQueryParams(json, true);

    expect(result).not.toBeNull();
    expect(result?.queryParams.aggregateFields).toEqual([
      new VisualizeFunction('p50(value,test_metric,distribution,-)'),
      new VisualizeFunction('p75(value,test_metric,distribution,-)'),
      {groupBy: 'environment'},
    ]);
  });

  it('round-trips encode/decode with multiVisualize', () => {
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
    const decoded = decodeMetricsQueryParams(encoded, true);

    expect(decoded).not.toBeNull();
    expect(decoded?.metric).toEqual(original.metric);
    expect(decoded?.queryParams.aggregateFields).toEqual(
      original.queryParams.aggregateFields
    );
  });
});
