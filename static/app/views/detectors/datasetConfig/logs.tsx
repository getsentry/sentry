import type {EventsStats} from 'sentry/types/organization';
import {LogsConfig} from 'sentry/views/dashboards/datasetConfig/logs';
import {TraceSearchBar} from 'sentry/views/detectors/datasetConfig/components/traceSearchBar';
import {
  getDiscoverSeriesQueryOptions,
  transformEventsStatsComparisonSeries,
  transformEventsStatsToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';
import {
  BASE_INTERVALS,
  DYNAMIC_INTERVALS,
  getEapTimePeriodsForInterval,
  MetricDetectorInterval,
} from 'sentry/views/detectors/datasetConfig/utils/timePeriods';

import type {DetectorDatasetConfig} from './base';

type LogsSeriesRepsonse = EventsStats;

export const DetectorLogsConfig: DetectorDatasetConfig<LogsSeriesRepsonse> = {
  defaultField: LogsConfig.defaultField,
  getAggregateOptions: LogsConfig.getTableFieldOptions,
  SearchBar: TraceSearchBar,
  getSeriesQueryOptions: getDiscoverSeriesQueryOptions,
  getAvailableIntervals: ({detectionType}) => {
    const intervals = detectionType === 'dynamic' ? DYNAMIC_INTERVALS : BASE_INTERVALS;
    // EAP does not support minute intervals
    return intervals.filter(interval => interval !== MetricDetectorInterval.ONE_MINUTE);
  },
  getAvailableTimePeriods: interval => getEapTimePeriodsForInterval(interval),
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
