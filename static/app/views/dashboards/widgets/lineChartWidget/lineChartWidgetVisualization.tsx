import BaseChart from 'sentry/components/charts/baseChart';
import LineSeries from 'sentry/components/charts/series/lineSeries';

import type {Meta, TimeseriesData} from '../common/types';

export interface LineChartWidgetVisualizationProps {
  timeseries: TimeseriesData[];
  meta?: Meta;
}

export function LineChartWidgetVisualization(props: LineChartWidgetVisualizationProps) {
  return (
    <BaseChart
      series={props.timeseries.map(timeserie => {
        return LineSeries({
          name: timeserie.field,
          data: timeserie.data.map(datum => {
            return [datum.timestamp, datum.value];
          }),
        });
      })}
    />
  );
}
