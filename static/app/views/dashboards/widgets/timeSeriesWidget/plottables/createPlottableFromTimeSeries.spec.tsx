import {WidgetFixture} from 'sentry-fixture/widget';

import {DisplayType} from 'sentry/views/dashboards/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';

import {createPlottableFromTimeSeries} from './createPlottableFromTimeSeries';

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
