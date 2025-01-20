import {
  TimeSeriesWidgetVisualization,
  type TimeSeriesWidgetVisualizationProps,
} from '../timeSeriesWidget/timeSeriesWidgetVisualization';

import {BarChartWidgetSeries} from './barChartWidgetSeries';

export interface BarChartWidgetVisualizationProps
  extends Omit<TimeSeriesWidgetVisualizationProps, 'SeriesConstructor'> {}

export function BarChartWidgetVisualization(props: BarChartWidgetVisualizationProps) {
  return (
    <TimeSeriesWidgetVisualization {...props} SeriesConstructor={BarChartWidgetSeries} />
  );
}
