import LineSeries from 'sentry/components/charts/series/lineSeries';

import type {TimeseriesData} from '../../common/types';

export function CompleteAreaChartWidgetSeries(timeserie: TimeseriesData) {
  return LineSeries({
    name: timeserie.field,
    color: timeserie.color,
    stack: 'complete',
    animation: false,
    areaStyle: {
      color: timeserie.color,
      opacity: 1.0,
    },
    data: timeserie.data.map(datum => {
      return [datum.timestamp, datum.value];
    }),
  });
}
