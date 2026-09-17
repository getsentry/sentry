import type {SelectValue} from '@sentry/scraps/select';

import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import type {EventsStats, Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {EventTypes} from 'sentry/views/alerts/rules/metric/types';
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

// Apdex does not support the satisfaction parameter, so we need to remove that from the config.
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
      const query = DetectorTransactionsConfig.toSnubaQueryString({
        eventTypes: options.eventTypes,
        query: options.query,
      });

      return getDiscoverSeriesQueryOptions({
        ...options,
        query,
        statsPeriod: options.statsPeriod,
        dataset: DetectorTransactionsConfig.getDiscoverDataset(),
        aggregate: translateAggregateTag(options.aggregate),
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
    getDiscoverDataset: () => DiscoverDatasets.TRANSACTIONS,
  };
