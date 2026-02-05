import {WidgetFixture} from 'sentry-fixture/widget';

import {DisplayType} from 'sentry/views/dashboards/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';

import {
  createPlottableFromTimeSeries,
  transformLegacySeriesToTimeSeries,
} from './transformLegacySeriesToPlottables';

describe('transformLegacySeriesToTimeSeries', () => {
  it('returns null for undefined series', () => {
    expect(transformLegacySeriesToTimeSeries(undefined, undefined, undefined)).toBeNull();
  });

  it('transforms series data correctly', () => {
    const series = {
      seriesName: 'count()',
      data: [
        {name: 1729796400000, value: 100},
        {name: 1729800000000, value: 200},
      ],
    };

    const timeSeries = transformLegacySeriesToTimeSeries(series, undefined, undefined);

    expect(timeSeries).not.toBeNull();
    expect(timeSeries!.yAxis).toBe('count()');
    expect(timeSeries!.values).toHaveLength(2);
    expect(timeSeries!.values[0]).toMatchObject({timestamp: 1729796400000, value: 100});
    expect(timeSeries!.values[1]).toMatchObject({timestamp: 1729800000000, value: 200});
    expect(timeSeries!.meta.valueType).toBe('number');
  });

  it('handles alias series names', () => {
    const series = {
      seriesName: 'my_alias : epm()',
      data: [
        {name: 1729796400000, value: 100},
        {name: 1729800000000, value: 200},
      ],
    };

    const timeSeries = transformLegacySeriesToTimeSeries(series, undefined, undefined);

    expect(timeSeries).not.toBeNull();
    expect(timeSeries!.meta.valueUnit).toBe('1/minute');
  });

  it('sets isOther to true for "Other" series', () => {
    const otherSeries = {
      seriesName: 'Other',
      data: [{name: 1729796400000, value: 100}],
    };
    const aliasedOtherSeries = {
      seriesName: 'count() : Other',
      data: [{name: 1729796400000, value: 100}],
    };
    const regularSeries = {
      seriesName: 'count()',
      data: [{name: 1729796400000, value: 100}],
    };

    expect(
      transformLegacySeriesToTimeSeries(otherSeries, undefined, undefined)!.meta.isOther
    ).toBe(true);
    expect(
      transformLegacySeriesToTimeSeries(aliasedOtherSeries, undefined, undefined)!.meta
        .isOther
    ).toBe(true);
    expect(
      transformLegacySeriesToTimeSeries(regularSeries, undefined, undefined)!.meta.isOther
    ).toBe(false);
  });

  it('transforms session series data correctly', () => {
    const erroredRateSeries = {
      seriesName: 'errored_rate(session)',
      data: [
        {name: 172979640, value: 100},
        {name: 172980000, value: 200},
      ],
    };
    const sumSessionSeries = {
      seriesName: 'sum(session)',
      data: [
        {name: 172979640, value: 300},
        {name: 172980000, value: 400},
      ],
    };

    const erroredRateTimeSeries = transformLegacySeriesToTimeSeries(
      erroredRateSeries,
      undefined,
      undefined
    );
    const sumSessionTimeSeries = transformLegacySeriesToTimeSeries(
      sumSessionSeries,
      undefined,
      undefined
    );

    expect(erroredRateTimeSeries!.yAxis).toBe('errored_rate(session)');
    expect(sumSessionTimeSeries!.yAxis).toBe('sum(session)');
    expect(erroredRateTimeSeries!.values).toHaveLength(2);
    expect(erroredRateTimeSeries!.values[0]).toMatchObject({
      timestamp: 172979640,
      value: 100,
    });
    expect(erroredRateTimeSeries!.values[1]).toMatchObject({
      timestamp: 172980000,
      value: 200,
    });
    expect(sumSessionTimeSeries!.values).toHaveLength(2);
    expect(sumSessionTimeSeries!.values[0]).toMatchObject({
      timestamp: 172979640,
      value: 300,
    });
    expect(sumSessionTimeSeries!.values[1]).toMatchObject({
      timestamp: 172980000,
      value: 400,
    });
    expect(erroredRateTimeSeries!.meta.valueType).toBe('percentage');
    expect(sumSessionTimeSeries!.meta.valueType).toBe('number');
    expect(erroredRateTimeSeries!.meta.interval).toBe(360);
    expect(sumSessionTimeSeries!.meta.interval).toBe(360);
  });
});

describe('createPlottableFromTimeSeries', () => {
  const mockTimeSeries = {
    yAxis: 'count()',
    values: [
      {timestamp: 1729796400000, value: 100, incomplete: false},
      {timestamp: 1729800000000, value: 200, incomplete: false},
    ],
    meta: {
      valueType: 'number' as const,
      valueUnit: null,
      interval: 3600,
    },
  };

  it('creates Line instance for LINE display type', () => {
    const widget = WidgetFixture({displayType: DisplayType.LINE});
    const plottable = createPlottableFromTimeSeries(mockTimeSeries, widget);

    expect(plottable).toBeInstanceOf(Line);
  });

  it('creates Area instance for AREA display type', () => {
    const widget = WidgetFixture({displayType: DisplayType.AREA});
    const plottable = createPlottableFromTimeSeries(mockTimeSeries, widget);

    expect(plottable).toBeInstanceOf(Area);
  });

  it('creates Bars instance for BAR display type', () => {
    const widget = WidgetFixture({displayType: DisplayType.BAR});
    const plottable = createPlottableFromTimeSeries(mockTimeSeries, widget);

    expect(plottable).toBeInstanceOf(Bars);
  });

  it('returns null for TABLE display type', () => {
    const widget = WidgetFixture({displayType: DisplayType.TABLE});
    const plottable = createPlottableFromTimeSeries(mockTimeSeries, widget);

    expect(plottable).toBeNull();
  });
});
