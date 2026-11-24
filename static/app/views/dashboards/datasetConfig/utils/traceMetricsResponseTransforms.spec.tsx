import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {DurationUnit} from 'sentry/utils/discover/fields';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {WidgetType} from 'sentry/views/dashboards/types';
import {
  WEB_VITAL_SCORE_FIELDS,
  webVitalScoreField,
} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';

import {traceMetricsResponseTransforms} from './traceMetricsResponseTransforms';

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

  it('types virtual metric series by the virtual metric unit', () => {
    const aggregates = [
      'avg(tags[score.ratio.lcp,number],browser.web_vital.lcp,distribution,millisecond)',
      'count(tags[score.ratio.lcp,number],browser.web_vital.lcp,distribution,millisecond)',
      'avg(value,browser.web_vital.lcp,distribution,millisecond)',
    ];
    const widget = WidgetFixture({
      widgetType: WidgetType.TRACEMETRICS,
      queries: [WidgetQueryFixture({aggregates, columns: []})],
    });
    const data = response(aggregates);
    data.timeSeries.forEach(timeSeries => {
      timeSeries.meta.valueType = timeSeries.yAxis.startsWith('count')
        ? 'integer'
        : 'duration';
      timeSeries.meta.valueUnit = timeSeries.yAxis.startsWith('count')
        ? null
        : DurationUnit.MILLISECOND;
    });

    const result = traceMetricsResponseTransforms.transformTimeSeries!(data, widget, 0);
    const metaByYAxis = Object.fromEntries(
      result.map(r => [r.timeSeries.yAxis, r.timeSeries.meta])
    );

    expect(metaByYAxis[aggregates[0]!]).toEqual(
      expect.objectContaining({valueType: 'percentage', valueUnit: null})
    );
    expect(metaByYAxis[aggregates[1]!]).toEqual(
      expect.objectContaining({valueType: 'integer', valueUnit: null})
    );
    expect(metaByYAxis[aggregates[2]!]).toEqual(
      expect.objectContaining({
        valueType: 'duration',
        valueUnit: DurationUnit.MILLISECOND,
      })
    );
  });
});

describe('traceMetricsResponseTransforms.transformTable', () => {
  it('types virtual metric columns by the virtual metric unit', () => {
    const score =
      'avg(tags[score.ratio.lcp,number],browser.web_vital.lcp,distribution,millisecond)';
    const scoreCount =
      'count(tags[score.ratio.lcp,number],browser.web_vital.lcp,distribution,millisecond)';
    const value = 'avg(value,browser.web_vital.lcp,distribution,millisecond)';
    const widgetQuery = WidgetQueryFixture({
      aggregates: [score, scoreCount, value],
      columns: [],
    });

    const result = traceMetricsResponseTransforms.transformTable!(
      {
        data: [{id: '1', [score]: 0.8, [scoreCount]: 3, [value]: 2000}],
        meta: {
          fields: {[score]: 'duration', [scoreCount]: 'integer', [value]: 'duration'},
          units: {[score]: 'millisecond', [value]: 'millisecond'},
        },
      },
      widgetQuery,
      OrganizationFixture(),
      PageFiltersFixture()
    );

    expect(result.meta?.fields).toEqual({
      [score]: 'percentage',
      [scoreCount]: 'integer',
      [value]: 'duration',
    });
    expect(result.meta?.units).toEqual({[value]: 'millisecond'});
  });
});
