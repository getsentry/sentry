import {
  InsightsTimeSeriesWidget,
  type InsightsTimeSeriesWidgetProps,
} from './insightsTimeSeriesWidget';

interface InsightsBarChartWidgetProps
  extends Omit<InsightsTimeSeriesWidgetProps, 'visualizationType'> {
  stacked?: boolean;
}

export function InsightsBarChartWidget(props: InsightsBarChartWidgetProps) {
  if (!props.series.some(item => item.data?.length > 0)) {
    return null;
  }

  return <InsightsTimeSeriesWidget {...props} visualizationType="bar" />;
}
