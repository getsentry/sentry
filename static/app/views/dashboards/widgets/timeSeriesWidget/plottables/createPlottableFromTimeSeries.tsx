import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';

type PlottableConfig = {
  alias?: string;
  color?: string;
  name?: string;
  stack?: string;
};

export function createPlottableFromTimeSeries(
  displayType: DisplayType,
  timeSeries: TimeSeries,
  config?: PlottableConfig
): Plottable | null {
  switch (displayType) {
    case DisplayType.LINE:
      return new Line(timeSeries, config);
    case DisplayType.AREA:
      return new Area(timeSeries, config);
    case DisplayType.BAR:
      return new Bars(timeSeries, config);
    default:
      return null;
  }
}

export function createPlottableFromTimeSeriesAndWidget(
  timeSeries: TimeSeries,
  widget: Widget,
  alias?: string,
  name?: string,
  color?: string
): Plottable | null {
  const shouldStack = widget.queries[0]?.columns.length! > 0;

  return createPlottableFromTimeSeries(widget.displayType, timeSeries, {
    alias,
    name,
    color,
    stack: shouldStack ? widget.title : undefined,
  });
}
