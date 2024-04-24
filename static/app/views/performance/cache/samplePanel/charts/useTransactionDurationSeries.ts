import keyBy from 'lodash/keyBy';

import type {Series} from 'sentry/types/echarts';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getSeriesEventView} from 'sentry/views/starfish/queries/getSeriesEventView';
import type {MetricTimeseriesRow} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {useWrappedDiscoverTimeseriesQuery} from 'sentry/views/starfish/utils/useSpansQuery';

// TODO - this is pretty much the same as `useSpanMetricsSeries`, we should probably consider making useMetricsSeries later on
export const useTransactionDurationSeries = (options: {
  referrer: string;
  transactionName: string;
  enabled?: boolean;
}) => {
  const pageFilters = usePageFilters();

  const {transactionName, referrer} = options;

  const filters = {
    transaction: transactionName,
  };

  const yAxis = ['avg(transaction.duration)'];

  const eventView = getSeriesEventView(
    MutableSearch.fromQueryObject(filters),
    undefined,
    pageFilters.selection,
    yAxis,
    undefined,
    DiscoverDatasets.METRICS
  );

  const result = useWrappedDiscoverTimeseriesQuery<MetricTimeseriesRow[]>({
    eventView,
    initialData: [],
    referrer,
    enabled: options.enabled,
  });

  const parsedData = keyBy(
    yAxis.map(seriesName => {
      const series: Series = {
        seriesName,
        data: (result?.data ?? []).map(datum => ({
          value: datum[seriesName],
          name: datum?.interval,
        })),
      };

      return series;
    }),
    'seriesName'
  ) as Record<'avg(transaction.duration)', Series>;

  return {...result, data: parsedData};
};
