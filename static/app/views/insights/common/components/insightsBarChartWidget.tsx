import {
  InsightsTimeSeriesWidget,
  type InsightsTimeSeriesWidgetProps,
} from './insightsTimeSeriesWidget';

interface InsightsBarChartWidgetProps
  extends Omit<InsightsTimeSeriesWidgetProps, 'visualizationType'> {
  stacked?: boolean;
}

export function InsightsBarChartWidget(props: InsightsBarChartWidgetProps) {
  return <InsightsTimeSeriesWidget {...props} visualizationType="bar" />;
}
