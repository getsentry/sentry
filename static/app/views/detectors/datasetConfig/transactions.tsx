import type {EventsStats} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {TransactionsConfig} from 'sentry/views/dashboards/datasetConfig/transactions';
import {TraceSearchBar} from 'sentry/views/detectors/datasetConfig/components/traceSearchBar';
import {
  getDiscoverSeriesQueryOptions,
  transformEventsStatsComparisonSeries,
  transformEventsStatsToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';

import type {DetectorDatasetConfig} from './base';
import {DEFAULT_EVENT_TYPES_BY_DATASET, parseEventTypesFromQuery} from './eventTypes';
import {DetectorDataset} from './types';

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
    separateEventTypesFromQuery: query =>
      parseEventTypesFromQuery(
        query,
        DEFAULT_EVENT_TYPES_BY_DATASET[DetectorDataset.TRANSACTIONS]
      ),
    toSnubaQueryString: snubaQuery => snubaQuery?.query ?? '',
    transformSeriesQueryData: (data, aggregate) => {
      return [transformEventsStatsToSeries(data, aggregate)];
    },
    transformComparisonSeriesData: data => {
      return [transformEventsStatsComparisonSeries(data)];
    },
    fromApiAggregate: aggregate => aggregate,
    toApiAggregate: aggregate => aggregate,
    supportedDetectionTypes: ['static', 'percent', 'dynamic'],
  };
