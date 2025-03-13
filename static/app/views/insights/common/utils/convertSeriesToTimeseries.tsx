import type {DataUnit} from 'sentry/utils/discover/fields';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import type {DiscoverSeries} from '../queries/useDiscoverSeries';

export function convertSeriesToTimeseries(series: DiscoverSeries): TimeSeries {
  return {
    field: series.seriesName,
    meta: {
      // This behavior is a little awkward. Normally `meta` shouldn't be missing, but we sometime return blank meta from helper hooks
      type: series.meta?.fields?.[series.seriesName] ?? null,
      unit: (series.meta?.units?.[series.seriesName] ?? null) as DataUnit,
    },
    data: (series?.data ?? []).map(datum => ({
      timestamp: datum.name.toString(),
      value: datum.value,
    })),
  };
}
