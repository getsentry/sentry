import {
  TimeSeriesWidget,
  type TimeSeriesWidgetProps,
} from '../timeSeriesWidget/timeSeriesWidget';

export interface AreaChartWidgetProps
  extends Omit<TimeSeriesWidgetProps, 'visualizationType'> {}

export function AreaChartWidget(props: AreaChartWidgetProps) {
  return <TimeSeriesWidget {...props} visualizationType="area" />;
}
