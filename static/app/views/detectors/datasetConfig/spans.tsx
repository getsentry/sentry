import type {EventsStats} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
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

import type {DetectorDatasetConfig} from './base';
import {parseEventTypesFromQuery} from './eventTypes';

type SpansSeriesResponse = EventsStats;

const DEFAULT_EVENT_TYPES = [EventTypes.TRACE_ITEM_SPAN];

export const DetectorSpansConfig: DetectorDatasetConfig<SpansSeriesResponse> = {
  SearchBar: TraceSearchBar,
  defaultEventTypes: DEFAULT_EVENT_TYPES,
  defaultField: SpansConfig.defaultField,
  getAggregateOptions: SpansConfig.getTableFieldOptions,
  getSeriesQueryOptions: options => {
    return getDiscoverSeriesQueryOptions({
      ...options,
      dataset: DetectorSpansConfig.getDiscoverDataset(),
    });
  },
  getIntervals: ({detectionType}) => {
    const intervals =
      detectionType === 'dynamic' ? BASE_DYNAMIC_INTERVALS : BASE_INTERVALS;
    // EAP does not support minute intervals
    return intervals.filter(interval => interval > MetricDetectorInterval.ONE_MINUTE);
  },
  getTimePeriods: interval => getEapTimePeriodsForInterval(interval),
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
  getDiscoverDataset: () => DiscoverDatasets.SPANS,
};
