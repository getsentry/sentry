import {
  TimeSeriesWidgetVisualization,
  type TimeSeriesWidgetVisualizationProps,
} from '../timeSeriesWidget/timeSeriesWidgetVisualization';

import {AreaChartWidgetSeries} from './areaChartWidgetSeries';

export interface AreaChartWidgetVisualizationProps
  extends Omit<TimeSeriesWidgetVisualizationProps, 'SeriesConstructor'> {}

export function AreaChartWidgetVisualization(props: AreaChartWidgetVisualizationProps) {
  return (
    <TimeSeriesWidgetVisualization {...props} SeriesConstructor={AreaChartWidgetSeries} />
  );
}
