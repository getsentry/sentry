import type {TimeseriesData} from 'sentry/views/dashboards/widgets/common/types';

import type {DiscoverSeries} from '../queries/useDiscoverSeries';

export function convertSeriesToTimeseries(series: DiscoverSeries): TimeseriesData {
  return {
    field: series.seriesName,
    meta: series.meta,
    color: series.color,
    data: (series?.data ?? []).map(datum => ({
      timestamp: new Date(datum.name).toISOString(),
      value: datum.value,
    })),
  };
}
