import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {traceMetricsResponseTransforms} from 'sentry/views/dashboards/datasetConfig/utils/traceMetricsResponseTransforms';
import {WidgetType} from 'sentry/views/dashboards/types';
import {
  WEB_VITAL_SCORE_FIELDS,
  webVitalCountField,
  webVitalScoreField,
} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';

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

  it('keeps the full name of score fields so each series stays distinct', () => {
    const aggregates = [webVitalScoreField('lcp'), webVitalCountField('ttfb')];
    const widget = WidgetFixture({
      widgetType: WidgetType.TRACEMETRICS,
      queries: [WidgetQueryFixture({aggregates, columns: []})],
    });

    const result = traceMetricsResponseTransforms.transformTimeSeries!(
      response(aggregates),
      widget,
      0
    );

    expect(result.map(r => r.seriesName)).toEqual([
      'avg(score.ratio.lcp,browser.web_vital.lcp,distribution,millisecond)',
      'count(browser.web_vital.ttfb)',
    ]);
  });

  it('weights the score breakdown chart like the spans dataset', () => {
    const aggregates = WEB_VITAL_SCORE_FIELDS;
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
      result.map(r => [r.timeSeries.yAxis, r.timeSeries.values[0]!.value])
    );
    // Every vital has data, so the default weights (in percent) apply and the
    // five contributions add up to a total score of 100.
    expect(valueByVital[webVitalScoreField('lcp')]).toBeCloseTo(30);
    expect(valueByVital[webVitalScoreField('inp')]).toBeCloseTo(30);
    expect(valueByVital[webVitalScoreField('fcp')]).toBeCloseTo(15);
    expect(valueByVital[webVitalScoreField('cls')]).toBeCloseTo(15);
    expect(valueByVital[webVitalScoreField('ttfb')]).toBeCloseTo(10);
    // The avg over a duration metric comes back typed as a duration
    expect(result.every(r => r.timeSeries.meta.valueType === 'score')).toBe(true);
  });
});
