import {WidgetFixture} from 'sentry-fixture/widget';

import {DisplayType} from 'sentry/views/dashboards/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {ContinuousTimeSeries} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/continuousTimeSeries';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';

import {transformLegacySeriesToPlottables} from './transformLegacySeriesToPlottables';

describe('transformLegacySeriesToPlottables', () => {
  it('returns empty array for empty or undefined legacy series', () => {
    const widget = WidgetFixture({displayType: DisplayType.LINE});

    expect(transformLegacySeriesToPlottables(undefined, undefined, widget)).toEqual([]);
    expect(transformLegacySeriesToPlottables([], undefined, widget)).toEqual([]);
  });

  it('creates correct plottable instances for different display types', () => {
    const series = [
      {
        seriesName: 'count()',
        data: [
          {name: 1729796400000, value: 100},
          {name: 1729800000000, value: 200},
        ],
      },
    ];
    expect(
      transformLegacySeriesToPlottables(
        series,
        undefined,
        WidgetFixture({displayType: DisplayType.LINE})
      )[0]
    ).toBeInstanceOf(Line);

    expect(
      transformLegacySeriesToPlottables(
        series,
        undefined,
        WidgetFixture({displayType: DisplayType.AREA})
      )[0]
    ).toBeInstanceOf(Area);

    expect(
      transformLegacySeriesToPlottables(
        series,
        undefined,
        WidgetFixture({displayType: DisplayType.BAR})
      )[0]
    ).toBeInstanceOf(Bars);

    expect(
      transformLegacySeriesToPlottables(
        series,
        undefined,
        WidgetFixture({displayType: DisplayType.TABLE})
      )
    ).toEqual([]);
  });

  it('transforms session series data correctly', () => {
    const widget = WidgetFixture({displayType: DisplayType.LINE});

    const sessionSeries = [
      {
        seriesName: 'errored_rate(session)',
        data: [
          {name: 1729796400000, value: 100},
          {name: 1729800000000, value: 200},
        ],
      },
      {
        seriesName: 'sum(session)',
        data: [
          {name: 1729796400000, value: 300},
          {name: 1729800000000, value: 400},
        ],
      },
    ];
    const sessionResult = transformLegacySeriesToPlottables(
      sessionSeries,
      undefined,
      widget
    ) as ContinuousTimeSeries[];

    expect(sessionResult[0]!.timeSeries.yAxis).toBe('errored_rate(session)');
    expect(sessionResult[1]!.timeSeries.yAxis).toBe('sum(session)');
    expect(sessionResult[0]!.timeSeries.values).toEqual([
      {timestamp: 1729796400000, value: 100, confidence: undefined},
      {timestamp: 1729800000000, value: 200, confidence: undefined},
    ]);
    expect(sessionResult[1]!.timeSeries.values).toEqual([
      {timestamp: 1729796400000, value: 300, confidence: undefined},
      {timestamp: 1729800000000, value: 400, confidence: undefined},
    ]);
    expect(sessionResult[0]!.timeSeries.meta.valueType).toBe('percentage');
    expect(sessionResult[1]!.timeSeries.meta.valueType).toBe('number');
    expect(sessionResult[0]!.timeSeries.meta.interval).toBe(3600000);
    expect(sessionResult[1]!.timeSeries.meta.interval).toBe(3600000);
  });
});
