import type {EventsStats} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {TransactionsConfig} from 'sentry/views/dashboards/datasetConfig/transactions';
import {TraceSearchBar} from 'sentry/views/detectors/datasetConfig/components/traceSearchBar';
import {
  getDiscoverSeriesQueryOptions,
  transformEventsStatsComparisonSeries,
  transformEventsStatsToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';
import {
  BASE_DYNAMIC_INTERVALS,
  BASE_INTERVALS,
  getStandardTimePeriodsForInterval,
  MetricDetectorTimePeriod,
} from 'sentry/views/detectors/datasetConfig/utils/timePeriods';

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
      // Force statsPeriod to be 9998m to avoid the 10k results limit.
      // This is specific to the transactions dataset, since it has 1m intervals and does not support 10k+ results.
      const isOneMinuteInterval = options.interval === 60;
      const timePeriod =
        options.statsPeriod === MetricDetectorTimePeriod.SEVEN_DAYS && isOneMinuteInterval
          ? '9998m'
          : options.statsPeriod;

      return getDiscoverSeriesQueryOptions({
        ...options,
        statsPeriod: timePeriod,
        dataset: DiscoverDatasets.DISCOVER,
      });
    },
    getIntervals: ({detectionType}) => {
      return detectionType === 'dynamic' ? BASE_DYNAMIC_INTERVALS : BASE_INTERVALS;
    },
    getTimePeriods: interval => getStandardTimePeriodsForInterval(interval),
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
