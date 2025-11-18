import {t} from 'sentry/locale';
import type {EventsStats} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {EventTypes} from 'sentry/views/alerts/rules/metric/types';
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
import {
  translateAggregateTag,
  translateAggregateTagBack,
} from 'sentry/views/detectors/datasetConfig/utils/translateAggregateTag';

import type {DetectorDatasetConfig} from './base';

type LogsSeriesRepsonse = EventsStats;

const DEFAULT_EVENT_TYPES = [EventTypes.TRACE_ITEM_LOG];

export const DetectorLogsConfig: DetectorDatasetConfig<LogsSeriesRepsonse> = {
  name: t('Logs'),
  SearchBar: TraceSearchBar,
  defaultEventTypes: DEFAULT_EVENT_TYPES,
  defaultField: LogsConfig.defaultField,
  getAggregateOptions: LogsConfig.getTableFieldOptions,
  getSeriesQueryOptions: options => {
    return getDiscoverSeriesQueryOptions({
      ...options,
      dataset: DetectorLogsConfig.getDiscoverDataset(),
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
    return {eventTypes: [EventTypes.TRACE_ITEM_LOG], query};
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
  getDiscoverDataset: () => DiscoverDatasets.OURLOGS,
  formatAggregateForTitle: aggregate => {
    if (aggregate === 'count()') {
      return t('Number of logs');
    }
    return aggregate;
  },
};
