import LineSeries from 'sentry/components/charts/series/lineSeries';

import type {TimeSeries} from '../../common/types';
import {timeSeriesItemToEChartsDataPoint} from '../timeSeriesItemToEChartsDataPoint';

export function IncompleteAreaChartWidgetSeries(timeSeries: TimeSeries) {
  return LineSeries({
    name: timeSeries.field,
    color: timeSeries.color,
    stack: 'incomplete',
    animation: false,
    data: timeSeries.data.map(timeSeriesItemToEChartsDataPoint),
    lineStyle: {
      type: 'dotted',
    },
    areaStyle: {
      color: timeSeries.color,
      opacity: 0.8,
    },
    silent: true,
  });
}
