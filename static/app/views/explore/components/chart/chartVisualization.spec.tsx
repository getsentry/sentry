import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {getSeriesAlias} from 'sentry/views/explore/components/chart/chartVisualization';

describe('getSeriesAlias', () => {
  it('returns undefined for series with groupBy to preserve grouped value display', () => {
    const series = TimeSeriesFixture({
      yAxis: 'avg(span.duration)',
      groupBy: [{key: 'span.op', value: 'db'}],
    });

    expect(getSeriesAlias(series)).toBeUndefined();
  });

  it('returns the provided label when available', () => {
    const series = TimeSeriesFixture({
      yAxis: 'avg(value,metric.name,distribution,-)',
    });

    const result = getSeriesAlias(series, 'avg(metric.name)');

    expect(result).toBe('avg(metric.name)');
  });

  it('prettifies aggregation when no label is provided', () => {
    const series = TimeSeriesFixture({
      yAxis: 'count(span.duration)',
    });

    const result = getSeriesAlias(series);

    expect(result).toBe('count(spans)');
  });

  it('returns formatted label for series without prettifiable yAxis', () => {
    const series = TimeSeriesFixture({
      yAxis: 'some_raw_value',
    });

    const result = getSeriesAlias(series);

    // formatTimeSeriesLabel returns the yAxis when there's no groupBy
    expect(result).toBe('some_raw_value');
  });

  it('ignores label when series has groupBy', () => {
    const series = TimeSeriesFixture({
      yAxis: 'avg(value,metric.name,distribution,-)',
      groupBy: [{key: 'http.method', value: 'GET'}],
    });

    // Even with a label provided, groupBy series should return undefined
    // to let the default formatting show the grouped value
    const result = getSeriesAlias(series, 'avg(metric.name)');

    expect(result).toBeUndefined();
  });

  it('handles empty groupBy array as no groupBy', () => {
    const series = TimeSeriesFixture({
      yAxis: 'count(span.duration)',
      groupBy: [],
    });

    const result = getSeriesAlias(series, 'count(spans)');

    expect(result).toBe('count(spans)');
  });
});
