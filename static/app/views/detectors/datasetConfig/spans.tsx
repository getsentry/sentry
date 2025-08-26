import type {EventsStats} from 'sentry/types/organization';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
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

type SpansSeriesResponse = EventsStats;

export const DetectorSpansConfig: DetectorDatasetConfig<SpansSeriesResponse> = {
  defaultField: SpansConfig.defaultField,
  getAggregateOptions: SpansConfig.getTableFieldOptions,
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
