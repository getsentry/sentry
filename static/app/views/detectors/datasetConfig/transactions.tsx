import type {EventsStats} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {isOnDemandAggregate, isOnDemandQueryString} from 'sentry/utils/onDemandMetrics';
import {hasOnDemandMetricAlertFeature} from 'sentry/utils/onDemandMetrics/features';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
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

const DEFAULT_EVENT_TYPES = [EventTypes.TRANSACTION];

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

      const hasMetricDataset =
        hasOnDemandMetricAlertFeature(options.organization) ||
        options.organization.features.includes('mep-rollout-flag') ||
        options.organization.features.includes('dashboards-metrics-transition');
      const isOnDemandQuery =
        options.dataset === Dataset.GENERIC_METRICS &&
        isOnDemandQueryString(options.query);
      const isOnDemand =
        hasMetricDataset && (isOnDemandAggregate(options.aggregate) || isOnDemandQuery);

      const query = DetectorTransactionsConfig.toSnubaQueryString({
        eventTypes: options.eventTypes,
        query: options.query,
      });

      return getDiscoverSeriesQueryOptions({
        ...options,
        query,
        statsPeriod: timePeriod,
        dataset: DetectorTransactionsConfig.getDiscoverDataset(),
        ...(isOnDemand && {extra: {useOnDemandMetrics: 'true'}}),
      });
    },
    getIntervals: ({detectionType}) => {
      return detectionType === 'dynamic' ? BASE_DYNAMIC_INTERVALS : BASE_INTERVALS;
    },
    getTimePeriods: interval => getStandardTimePeriodsForInterval(interval),
    separateEventTypesFromQuery: query =>
      parseEventTypesFromQuery(query, DEFAULT_EVENT_TYPES),
    toSnubaQueryString: snubaQuery => {
      if (!snubaQuery) {
        return '';
      }

      if (snubaQuery.query.includes('event.type:transaction')) {
        return snubaQuery.query;
      }

      return `event.type:transaction ${snubaQuery.query}`;
    },
    transformSeriesQueryData: (data, aggregate) => {
      return [transformEventsStatsToSeries(data, aggregate)];
    },
    transformComparisonSeriesData: data => {
      return [transformEventsStatsComparisonSeries(data)];
    },
    fromApiAggregate: aggregate => aggregate,
    toApiAggregate: aggregate => aggregate,
    supportedDetectionTypes: ['static', 'percent', 'dynamic'],
    // TODO: This will need to fall back to the discover dataset if metrics enhanced is not available?
    getDiscoverDataset: () => DiscoverDatasets.METRICS_ENHANCED,
  };
