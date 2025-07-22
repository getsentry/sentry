import type {EventsStats} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {TransactionsConfig} from 'sentry/views/dashboards/datasetConfig/transactions';
import {TraceSearchBar} from 'sentry/views/detectors/datasetConfig/components/traceSearchBar';
import {
  getDiscoverSeriesQueryOptions,
  transformEventsStatsToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';

import type {DetectorDatasetConfig} from './base';

type TransactionsSeriesResponse = EventsStats;

export const DetectorTransactionsConfig: DetectorDatasetConfig<TransactionsSeriesResponse> =
  {
    defaultField: TransactionsConfig.defaultField,
    getAggregateOptions: TransactionsConfig.getTableFieldOptions,
    SearchBar: TraceSearchBar,
    getSeriesQueryOptions: options =>
      getDiscoverSeriesQueryOptions({
        ...options,
        dataset: DiscoverDatasets.TRANSACTIONS,
      }),
    transformSeriesQueryData: (data, aggregate) => {
      return [transformEventsStatsToSeries(data, aggregate)];
    },
  };
