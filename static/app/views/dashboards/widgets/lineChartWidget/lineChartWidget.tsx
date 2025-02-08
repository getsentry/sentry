import {
  TimeSeriesWidget,
  type TimeSeriesWidgetProps,
} from '../timeSeriesWidget/timeSeriesWidget';

export interface LineChartWidgetProps
  extends Omit<TimeSeriesWidgetProps, 'visualizationType'> {}

export function LineChartWidget(props: LineChartWidgetProps) {
  return <TimeSeriesWidget {...props} visualizationType="line" />;
}
