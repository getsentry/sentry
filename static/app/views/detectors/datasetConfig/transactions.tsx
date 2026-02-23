import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import type {EventsStats, Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
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
import {
  translateAggregateTag,
  translateAggregateTagBack,
} from 'sentry/views/detectors/datasetConfig/utils/translateAggregateTag';
import {FieldValueKind, type FieldValue} from 'sentry/views/discover/table/types';

import type {DetectorDatasetConfig} from './base';
import {parseEventTypesFromQuery} from './eventTypes';

type TransactionsSeriesResponse = EventsStats;

const DEFAULT_EVENT_TYPES = [EventTypes.TRANSACTION];

// Because we are not actually using the transactions dataset (we are using metrics_enhanced),
// some of the fields are not supported. Apdex does not support the satisfaction parameter,
// so we need to remove that from the config.
// As the transaction dataset is deprecated, this entire config will be removed in the future.
function getAggregateOptions(
  organization: Organization,
  tags?: TagCollection,
  customMeasurements?: CustomMeasurementCollection
): Record<string, SelectValue<FieldValue>> {
  const base = TransactionsConfig.getTableFieldOptions(
    organization,
    tags,
    customMeasurements
  );

  const apdex = base['function:apdex'];

  if (!apdex) {
    return base;
  }

  return {
    ...base,
    'function:apdex': {
      ...apdex,
      value: {
        kind: FieldValueKind.FUNCTION,
        meta: {
          name: 'apdex',
          parameters: [],
        },
      },
    },
  };
}

export const DetectorTransactionsConfig: DetectorDatasetConfig<TransactionsSeriesResponse> =
  {
    name: t('Transactions'),
    SearchBar: TraceSearchBar,
    defaultEventTypes: DEFAULT_EVENT_TYPES,
    defaultField: TransactionsConfig.defaultField,
    getAggregateOptions,
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
        aggregate: translateAggregateTag(options.aggregate),
        ...(isOnDemand && {extra: {useOnDemandMetrics: 'true'}}),
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
    fromApiAggregate: aggregate => {
      return translateAggregateTag(aggregate);
    },
    toApiAggregate: aggregate => {
      return translateAggregateTagBack(aggregate);
    },
    supportedDetectionTypes: ['static', 'percent', 'dynamic'],
    // TODO: This will need to fall back to the discover dataset if metrics enhanced is not available?
    getDiscoverDataset: () => DiscoverDatasets.METRICS_ENHANCED,
  };
