import LineSeries from 'sentry/components/charts/series/lineSeries';

import type {TimeseriesData} from '../common/types';

/**
 *
 * @param timeserie
 * @param complete Whether this series is fully ingested and processed data, or it's still behind the ingestion delay
 */
export function AreaChartWidgetSeries(timeserie: TimeseriesData, complete?: boolean) {
  return complete
    ? LineSeries({
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
      })
    : LineSeries({
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
