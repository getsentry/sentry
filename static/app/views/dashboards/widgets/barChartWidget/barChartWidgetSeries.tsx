import BarSeries from 'sentry/components/charts/series/barSeries';

import type {TimeseriesData} from '../common/types';

/**
 *
 * @param timeserie
 * @param complete Whether this series is fully ingested and processed data, or it's still behind the ingestion delay
 */
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
