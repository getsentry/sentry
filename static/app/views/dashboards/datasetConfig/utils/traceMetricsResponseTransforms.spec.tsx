import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {traceMetricsResponseTransforms} from 'sentry/views/dashboards/datasetConfig/utils/traceMetricsResponseTransforms';
import {WidgetType} from 'sentry/views/dashboards/types';

function response(yAxes: string[], value = 1): EventsTimeSeriesResponse {
  return {
    timeSeries: yAxes.map((yAxis, order) =>
      TimeSeriesFixture({
        yAxis,
        meta: {valueType: 'number', valueUnit: null, interval: 300_000, order},
        values: [{timestamp: 1729796400000, value}],
      })
    ),
  };
}

describe('traceMetricsResponseTransforms.transformTimeSeries', () => {
  it('shortens metric aggregates to the metric name', () => {
    const aggregates = ['p75(value,browser.web_vital.lcp,distribution,millisecond)'];
    const widget = WidgetFixture({
      widgetType: WidgetType.TRACEMETRICS,
      queries: [WidgetQueryFixture({aggregates, columns: []})],
    });

    const result = traceMetricsResponseTransforms.transformTimeSeries!(
      response(aggregates),
      widget,
      0
    );

    expect(result.map(r => r.seriesName)).toEqual(['p75(browser.web_vital.lcp)']);
  });

  it('keeps the full name of score formulas so each series stays distinct', () => {
    const aggregates = [
      'performance_score(measurements.score.lcp)',
      'count_scores(measurements.score.total)',
    ];
    const widget = WidgetFixture({
      widgetType: WidgetType.TRACEMETRICS,
      queries: [WidgetQueryFixture({aggregates, columns: []})],
    });

    const result = traceMetricsResponseTransforms.transformTimeSeries!(
      response(aggregates),
      widget,
      0
    );

    expect(result.map(r => r.seriesName)).toEqual(aggregates);
  });

  it('weights the score breakdown chart like the spans dataset', () => {
    const aggregates = [
      'performance_score(measurements.score.lcp)',
      'performance_score(measurements.score.fcp)',
      'performance_score(measurements.score.inp)',
      'performance_score(measurements.score.cls)',
      'performance_score(measurements.score.ttfb)',
    ];
    const widget = WidgetFixture({
      widgetType: WidgetType.TRACEMETRICS,
      queries: [WidgetQueryFixture({aggregates, columns: []})],
    });

    const result = traceMetricsResponseTransforms.transformTimeSeries!(
      response(aggregates),
      widget,
      0
    );

    const valueByVital = Object.fromEntries(
      result.map(r => [r.seriesName, r.timeSeries.values[0]!.value])
    );
    // Every vital has data, so the default weights (in percent) apply and the
    // five contributions add up to a total score of 100.
    expect(valueByVital['performance_score(measurements.score.lcp)']).toBeCloseTo(30);
    expect(valueByVital['performance_score(measurements.score.inp)']).toBeCloseTo(30);
    expect(valueByVital['performance_score(measurements.score.fcp)']).toBeCloseTo(15);
    expect(valueByVital['performance_score(measurements.score.cls)']).toBeCloseTo(15);
    expect(valueByVital['performance_score(measurements.score.ttfb)']).toBeCloseTo(10);
  });
});
