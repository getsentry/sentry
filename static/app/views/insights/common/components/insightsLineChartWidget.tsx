import {
  InsightsTimeSeriesWidget,
  type InsightsTimeSeriesWidgetProps,
} from './insightsTimeSeriesWidget';

interface InsightsLineChartWidgetProps
  extends Omit<InsightsTimeSeriesWidgetProps, 'visualizationType'> {}

export function InsightsLineChartWidget(props: InsightsLineChartWidgetProps) {
  return <InsightsTimeSeriesWidget {...props} visualizationType="line" />;
}
