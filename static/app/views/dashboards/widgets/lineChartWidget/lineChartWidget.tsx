import {
  TimeSeriesWidget,
  type TimeSeriesWidgetProps,
} from '../timeSeriesWidget/timeSeriesWidget';

import {LineChartWidgetSeries} from './lineChartWidgetSeries';

export interface LineChartWidgetProps
  extends Omit<TimeSeriesWidgetProps, 'SeriesConstructor'> {}

export function LineChartWidget(props: LineChartWidgetProps) {
  return <TimeSeriesWidget {...props} SeriesConstructor={LineChartWidgetSeries} />;
}
