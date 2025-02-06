import LineSeries from 'sentry/components/charts/series/lineSeries';

import type {TimeseriesData} from '../../common/types';

export function IncompleteAreaChartWidgetSeries(timeserie: TimeseriesData) {
  return LineSeries({
    name: timeserie.field,
    color: timeserie.color,
    stack: 'incomplete',
    animation: false,
    data: timeserie.data.map(datum => {
      return [datum.timestamp, datum.value];
    }),
    lineStyle: {
      type: 'dotted',
    },
    areaStyle: {
      color: timeserie.color,
      opacity: 0.8,
    },
    silent: true,
  });
}
