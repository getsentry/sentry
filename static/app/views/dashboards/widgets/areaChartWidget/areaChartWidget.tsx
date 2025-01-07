import {
  TimeSeriesWidget,
  type TimeSeriesWidgetProps,
} from '../timeSeriesWidget/timeSeriesWidget';

import {AreaChartWidgetSeries} from './areaChartWidgetSeries';

export interface AreaChartWidgetProps
  extends Omit<TimeSeriesWidgetProps, 'SeriesConstructor'> {}

export function AreaChartWidget(props: AreaChartWidgetProps) {
  return <TimeSeriesWidget {...props} SeriesConstructor={AreaChartWidgetSeries} />;
}
