import LineSeries from 'sentry/components/charts/series/lineSeries';

import type {TimeSeries} from '../../common/types';
import {timeSeriesItemToEChartsDataPoint} from '../timeSeriesItemToEChartsDataPoint';

export function IncompleteLineChartWidgetSeries(timeSeries: TimeSeries) {
  return LineSeries({
    name: timeSeries.field,
    color: timeSeries.color,
    animation: false,
    data: timeSeries.data.map(timeSeriesItemToEChartsDataPoint),
    lineStyle: {
      type: 'dotted',
    },
    silent: true,
  });
}
