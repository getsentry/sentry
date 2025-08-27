import type {EventsStats} from 'sentry/types/organization';
import {isOnDemandAggregate, isOnDemandQueryString} from 'sentry/utils/onDemandMetrics';
import {TransactionsConfig} from 'sentry/views/dashboards/datasetConfig/transactions';
import {TraceSearchBar} from 'sentry/views/detectors/datasetConfig/components/traceSearchBar';
import {
  getDiscoverSeriesQueryOptions,
  transformEventsStatsComparisonSeries,
  transformEventsStatsToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';

import type {DetectorDatasetConfig} from './base';
import {parseEventTypesFromQuery} from './eventTypes';

type TransactionsSeriesResponse = EventsStats;

const DEFAULT_EVENT_TYPES = ['transaction'];

export const DetectorTransactionsConfig: DetectorDatasetConfig<TransactionsSeriesResponse> =
  {
    SearchBar: TraceSearchBar,
    defaultEventTypes: DEFAULT_EVENT_TYPES,
    defaultField: TransactionsConfig.defaultField,
    getAggregateOptions: TransactionsConfig.getTableFieldOptions,
    getSeriesQueryOptions: options => {
      const isOnDemand =
        isOnDemandAggregate(options.aggregate) && isOnDemandQueryString(options.query);
      return getDiscoverSeriesQueryOptions({
        ...options,
        ...(isOnDemand && {extra: {useOnDemandMetrics: 'true'}}),
      });
    },
    separateEventTypesFromQuery: query =>
      parseEventTypesFromQuery(query, DEFAULT_EVENT_TYPES),
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
