import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';

export function createPlottableFromTimeSeries(
  timeSeries: TimeSeries,
  widget: Widget,
  alias?: string,
  name?: string,
  color?: string
): Plottable | null {
  const shouldStack = widget.queries[0]?.columns.length! > 0;

  const {displayType, title} = widget;
  switch (displayType) {
    case DisplayType.LINE:
      return new Line(timeSeries, {alias, name, color});
    case DisplayType.AREA:
      return new Area(timeSeries, {alias, name, color});
    case DisplayType.BAR:
      return new Bars(timeSeries, {
        stack: shouldStack ? title : undefined,
        alias,
        name,
        color,
      });
    default:
      return null;
  }
}
