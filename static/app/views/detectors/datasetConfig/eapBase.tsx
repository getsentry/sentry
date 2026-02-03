import type {SelectValue} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import type {EventsStats, Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {TraceSearchBar} from 'sentry/views/detectors/datasetConfig/components/traceSearchBar';
import {
  getDiscoverSeriesQueryOptions,
  transformEventsStatsComparisonSeries,
  transformEventsStatsToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';
import {
  BASE_DYNAMIC_INTERVALS,
  BASE_INTERVALS,
  getEapTimePeriodsForInterval,
  MetricDetectorInterval,
} from 'sentry/views/detectors/datasetConfig/utils/timePeriods';
import {
  translateAggregateTag,
  translateAggregateTagBack,
} from 'sentry/views/detectors/datasetConfig/utils/translateAggregateTag';
import type {FieldValue} from 'sentry/views/discover/table/types';

import type {DetectorDatasetConfig} from './base';

export type EapSeriesResponse = EventsStats;

interface EapDatasetOptions {
  defaultEventTypes: EventTypes[];
  defaultField: QueryFieldValue;
  discoverDataset: DiscoverDatasets;
  formatAggregateForTitle: (aggregate: string) => string;
  getAggregateOptions: (
    organization: Organization,
    tags?: TagCollection,
    customMeasurements?: CustomMeasurementCollection
  ) => Record<string, SelectValue<FieldValue>>;
  name: string;
}

/**
 * Creates a detector dataset config for EAP-based datasets (logs, metrics).
 * These share common behavior for intervals, time periods, transforms, etc.
 */
export function createEapDetectorConfig(
  options: EapDatasetOptions
): DetectorDatasetConfig<EapSeriesResponse> {
  const {
    name,
    defaultEventTypes,
    defaultField,
    getAggregateOptions,
    discoverDataset,
    formatAggregateForTitle,
  } = options;

  const config: DetectorDatasetConfig<EapSeriesResponse> = {
    name,
    SearchBar: TraceSearchBar,
    defaultEventTypes,
    defaultField,
    getAggregateOptions,
    getSeriesQueryOptions: queryOptions => {
      return getDiscoverSeriesQueryOptions({
        ...queryOptions,
        dataset: config.getDiscoverDataset(),
      });
    },
    getIntervals: ({detectionType}) => {
      const intervals =
        detectionType === 'dynamic' ? BASE_DYNAMIC_INTERVALS : BASE_INTERVALS;
      // EAP does not support minute intervals
      return intervals.filter(interval => interval > MetricDetectorInterval.ONE_MINUTE);
    },
    getTimePeriods: interval => getEapTimePeriodsForInterval(interval),
    separateEventTypesFromQuery: query => {
      return {eventTypes: defaultEventTypes, query};
    },
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
    getDiscoverDataset: () => discoverDataset,
    formatAggregateForTitle,
  };

  return config;
}
