import {
  TimeSeriesWidgetVisualization,
  type TimeSeriesWidgetVisualizationProps,
} from '../timeSeriesWidget/timeSeriesWidgetVisualization';

export interface BarChartWidgetVisualizationProps
  extends Omit<TimeSeriesWidgetVisualizationProps, 'visualizationType'> {}

export function BarChartWidgetVisualization(props: BarChartWidgetVisualizationProps) {
  return <TimeSeriesWidgetVisualization {...props} visualizationType="bar" />;
}
