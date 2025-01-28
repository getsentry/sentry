import {
  TimeSeriesWidgetVisualization,
  type TimeSeriesWidgetVisualizationProps,
} from '../timeSeriesWidget/timeSeriesWidgetVisualization';

export interface LineChartWidgetVisualizationProps
  extends Omit<TimeSeriesWidgetVisualizationProps, 'visualizationType'> {}

export function LineChartWidgetVisualization(props: LineChartWidgetVisualizationProps) {
  return <TimeSeriesWidgetVisualization {...props} visualizationType="line" />;
}
