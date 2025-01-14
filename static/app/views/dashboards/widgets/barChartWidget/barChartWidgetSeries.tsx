import BarSeries from 'sentry/components/charts/series/barSeries';

import type {TimeseriesData} from '../common/types';

export function BarChartWidgetSeries(timeserie: TimeseriesData, complete?: boolean) {
  return complete
    ? BarSeries({
        name: timeserie.field,
        color: timeserie.color,
        stack: 'complete',
        animation: false,
        itemStyle: {
          color: timeserie.color,
          opacity: 1.0,
        },
        data: timeserie.data.map(datum => {
          return [datum.timestamp, datum.value];
        }),
      })
    : BarSeries({
        name: timeserie.field,
        color: timeserie.color,
        stack: 'incomplete',
        animation: false,
        data: timeserie.data.map(datum => {
          return [datum.timestamp, datum.value];
        }),
        itemStyle: {
          color: timeserie.color,
          opacity: 0.8,
        },
        silent: true,
      });
}
