import {
  TimeSeriesWidgetVisualization,
  type TimeSeriesWidgetVisualizationProps,
} from '../timeSeriesWidget/timeSeriesWidgetVisualization';

import {LineChartWidgetSeries} from './lineChartWidgetSeries';

export interface LineChartWidgetVisualizationProps
  extends Omit<TimeSeriesWidgetVisualizationProps, 'SeriesConstructor'> {}

export function LineChartWidgetVisualization(props: LineChartWidgetVisualizationProps) {
  return (
    <TimeSeriesWidgetVisualization {...props} SeriesConstructor={LineChartWidgetSeries} />
  );
}
