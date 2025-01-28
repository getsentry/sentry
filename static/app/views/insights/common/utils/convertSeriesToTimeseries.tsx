import type {TimeseriesData} from 'sentry/views/dashboards/widgets/common/types';

import type {DiscoverSeries} from '../queries/useDiscoverSeries';

export function convertSeriesToTimeseries(series: DiscoverSeries): TimeseriesData {
  return {
    field: series.seriesName,
    meta: series.meta,
    data: (series?.data ?? []).map(datum => ({
      timestamp: datum.name.toString(),
      value: datum.value,
    })),
  };
}
