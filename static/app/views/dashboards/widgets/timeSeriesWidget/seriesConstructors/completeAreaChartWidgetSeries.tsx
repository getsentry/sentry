import LineSeries from 'sentry/components/charts/series/lineSeries';

import type {TimeSeries} from '../../common/types';
import {timeSeriesItemToEChartsDataPoint} from '../timeSeriesItemToEChartsDataPoint';

export function CompleteAreaChartWidgetSeries(timeSeries: TimeSeries) {
  return LineSeries({
    name: timeSeries.field,
    color: timeSeries.color,
    stack: 'complete',
    animation: false,
    areaStyle: {
      color: timeSeries.color,
      opacity: 1.0,
    },
    data: timeSeries.data.map(timeSeriesItemToEChartsDataPoint),
  });
}
