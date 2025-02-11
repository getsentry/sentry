import {
  TimeSeriesWidget,
  type TimeSeriesWidgetProps,
} from '../timeSeriesWidget/timeSeriesWidget';

export interface BarChartWidgetProps
  extends Omit<TimeSeriesWidgetProps, 'visualizationType'> {}

export function BarChartWidget(props: BarChartWidgetProps) {
  return <TimeSeriesWidget {...props} visualizationType="bar" />;
}
