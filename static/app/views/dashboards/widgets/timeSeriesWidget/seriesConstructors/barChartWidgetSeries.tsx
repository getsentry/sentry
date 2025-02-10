import Color from 'color';

import BarSeries from 'sentry/components/charts/series/barSeries';

import type {TimeseriesData} from '../../common/types';

export function BarChartWidgetSeries(timeserie: TimeseriesData, stack?: string) {
  return BarSeries({
    name: timeserie.field,
    color: timeserie.color,
    stack,
    animation: false,
    itemStyle: {
      color: params => {
        const datum = timeserie.data[params.dataIndex]!;

        return datum.delayed ? Color(params.color).lighten(0.5).string() : params.color!;
      },
      opacity: 1.0,
    },
    data: timeserie.data.map(datum => {
      return [datum.timestamp, datum.value];
    }),
  });
}
