import type {DataUnit} from 'sentry/utils/discover/fields';
import {getTimeSeriesInterval} from 'sentry/utils/timeSeries/getTimeSeriesInterval';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';

export function convertSeriesToTimeseries(series: DiscoverSeries): TimeSeries {
  const values = (series?.data ?? []).map(datum => {
    const timestamp =
      typeof datum.name === 'number'
        ? datum.name * 1000 // Timestamps from `events-stats` are in seconds
        : new Date(datum.name).getTime();

    return {
      timestamp,
      value: datum.value,
    };
  });

  const interval = getTimeSeriesInterval(values);

  return {
    yAxis: series.seriesName,
    values,
    meta: {
      // This behavior is a little awkward. Normally `meta` shouldn't be missing, but we sometime return blank meta from helper hooks
      valueType: series.meta?.fields?.[series.seriesName] ?? null,
      valueUnit: (series.meta?.units?.[series.seriesName] ?? null) as DataUnit,
      interval,
    },
  };
}
