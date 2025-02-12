import Color from 'color';

import BarSeries from 'sentry/components/charts/series/barSeries';

import type {TimeSeries} from '../../common/types';
import {timeSeriesItemToEChartsDataPoint} from '../timeSeriesItemToEChartsDataPoint';

export function BarChartWidgetSeries(timeSeries: TimeSeries, stack?: string) {
  return BarSeries({
    name: timeSeries.field,
    color: timeSeries.color,
    stack,
    animation: false,
    itemStyle: {
      color: params => {
        const datum = timeSeries.data[params.dataIndex]!;

        return datum.delayed ? Color(params.color).lighten(0.5).string() : params.color!;
      },
      opacity: 1.0,
    },
    data: timeSeries.data.map(timeSeriesItemToEChartsDataPoint),
  });
}
