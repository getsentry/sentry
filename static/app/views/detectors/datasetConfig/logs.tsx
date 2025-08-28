import type {EventsStats} from 'sentry/types/organization';
import {LogsConfig} from 'sentry/views/dashboards/datasetConfig/logs';
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

type LogsSeriesRepsonse = EventsStats;

const DEFAULT_EVENT_TYPES = ['trace_item_log'];

export const DetectorLogsConfig: DetectorDatasetConfig<LogsSeriesRepsonse> = {
  SearchBar: TraceSearchBar,
  defaultEventTypes: DEFAULT_EVENT_TYPES,
  defaultField: LogsConfig.defaultField,
  getAggregateOptions: LogsConfig.getTableFieldOptions,
  getSeriesQueryOptions: getDiscoverSeriesQueryOptions,
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
};
