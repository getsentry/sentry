import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {traceMetricsResponseTransforms} from 'sentry/views/dashboards/datasetConfig/utils/traceMetricsResponseTransforms';
import {WidgetType} from 'sentry/views/dashboards/types';
import {
  WEB_VITAL_SCORE_FIELDS,
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

    expect(valueByVital[webVitalScoreField('lcp')]).toBeCloseTo(30);
    expect(valueByVital[webVitalScoreField('inp')]).toBeCloseTo(30);
    expect(valueByVital[webVitalScoreField('fcp')]).toBeCloseTo(15);
    expect(valueByVital[webVitalScoreField('cls')]).toBeCloseTo(15);
    expect(valueByVital[webVitalScoreField('ttfb')]).toBeCloseTo(10);

    expect(result.every(r => r.timeSeries.meta.valueType === 'score')).toBe(true);
  });
});
