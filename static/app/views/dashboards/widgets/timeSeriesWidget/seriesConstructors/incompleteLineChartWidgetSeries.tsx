import LineSeries from 'sentry/components/charts/series/lineSeries';

import type {TimeseriesData} from '../../common/types';

export function IncompleteLineChartWidgetSeries(timeserie: TimeseriesData) {
  return LineSeries({
    name: timeserie.field,
    color: timeserie.color,
    animation: false,
    data: timeserie.data.map(datum => {
      return [datum.timestamp, datum.value];
    }),
    lineStyle: {
      type: 'dotted',
    },
    silent: true,
  });
}
