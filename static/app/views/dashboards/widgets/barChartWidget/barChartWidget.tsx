import {
  TimeSeriesWidget,
  type TimeSeriesWidgetProps,
} from '../timeSeriesWidget/timeSeriesWidget';

import {BarChartWidgetSeries} from './barChartWidgetSeries';

export interface BarChartWidgetProps
  extends Omit<TimeSeriesWidgetProps, 'SeriesConstructor'> {}

export function BarChartWidget(props: BarChartWidgetProps) {
  return <TimeSeriesWidget {...props} SeriesConstructor={BarChartWidgetSeries} />;
}
