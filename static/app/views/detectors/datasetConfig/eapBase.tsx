import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {isTokenFunction} from 'sentry/components/arithmeticBuilder/token';
import type {SelectValue} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {TagCollection} from 'sentry/types/group';
import type {EventsStats, Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {
  EQUATION_PREFIX,
  isEquation,
  stripEquationPrefix,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
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

type EapSeriesResponse = EventsStats;

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
  SearchBar?: DetectorDatasetConfig<EventsStats>['SearchBar'];
  transformSeriesQueryData?: (
    data: EventsStats | undefined,
    aggregate: string
  ) => Series[];
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
    SearchBar: CustomSearchBar,
    transformSeriesQueryData,
  } = options;

  const config: DetectorDatasetConfig<EapSeriesResponse> = {
    name,
    SearchBar: CustomSearchBar ?? TraceSearchBar,
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
      if (transformSeriesQueryData) {
        return transformSeriesQueryData(data, aggregate);
      }
      return [transformEventsStatsToSeries(data, aggregate)];
    },
    transformComparisonSeriesData: data => {
      return [transformEventsStatsComparisonSeries(data)];
    },
    fromApiAggregate: aggregate => {
      if (isEquation(aggregate)) {
        return stripEquationPrefix(aggregate);
      }

      return translateAggregateTag(aggregate);
    },
    toApiAggregate: aggregate => {
      aggregate = translateAggregateTagBack(aggregate);

      // Check to see if this aggregate is an equation with more than one function
      // This is the most reliable way we have to determine if this is an equation
      const expression = new Expression(aggregate);
      const functions = expression.tokens.filter(token => isTokenFunction(token));
      if (!isEquation(aggregate) && expression.isValid && functions.length > 1) {
        return `${EQUATION_PREFIX}${aggregate}`;
      }

      return aggregate;
    },
    supportedDetectionTypes: ['static', 'percent', 'dynamic'],
    getDiscoverDataset: () => discoverDataset,
    formatAggregateForTitle,
  };

  return config;
}
