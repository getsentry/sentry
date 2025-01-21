import {
  TimeSeriesWidgetVisualization,
  type TimeSeriesWidgetVisualizationProps,
} from '../timeSeriesWidget/timeSeriesWidgetVisualization';

export interface AreaChartWidgetVisualizationProps
  extends Omit<TimeSeriesWidgetVisualizationProps, 'visualizationType'> {}

export function AreaChartWidgetVisualization(props: AreaChartWidgetVisualizationProps) {
  return <TimeSeriesWidgetVisualization {...props} visualizationType="area" />;
}
