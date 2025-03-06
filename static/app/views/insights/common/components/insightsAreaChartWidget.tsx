import {
  InsightsTimeSeriesWidget,
  type InsightsTimeSeriesWidgetProps,
} from './insightsTimeSeriesWidget';

interface InsightsAreaChartWidgetProps
  extends Omit<InsightsTimeSeriesWidgetProps, 'visualizationType'> {}

export function InsightsAreaChartWidget(props: InsightsAreaChartWidgetProps) {
  return <InsightsTimeSeriesWidget {...props} visualizationType="area" />;
}
