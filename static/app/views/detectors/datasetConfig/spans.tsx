import {t} from 'sentry/locale';
import type {EventsStats} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
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
import {
  translateAggregateTag,
  translateAggregateTagBack,
} from 'sentry/views/detectors/datasetConfig/utils/translateAggregateTag';

import type {DetectorDatasetConfig} from './base';

type SpansSeriesResponse = EventsStats;

const DEFAULT_EVENT_TYPES = [EventTypes.TRACE_ITEM_SPAN];

export const DetectorSpansConfig: DetectorDatasetConfig<SpansSeriesResponse> = {
  name: t('Spans'),
  SearchBar: TraceSearchBar,
  defaultEventTypes: DEFAULT_EVENT_TYPES,
  defaultField: SpansConfig.defaultField,
  getAggregateOptions: SpansConfig.getTableFieldOptions,
  getSeriesQueryOptions: options => {
    return getDiscoverSeriesQueryOptions({
      ...options,
      dataset: DetectorSpansConfig.getDiscoverDataset(),
      aggregate: translateAggregateTag(options.aggregate),
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
    const search = new MutableSearch(query);

    // Query has `is_transaction:true`, set eventTypes to transaction
    if (
      search.hasFilter('is_transaction') &&
      search
        .getFilterValues('is_transaction')
        .map(value => value.toLowerCase())
        .includes('true')
    ) {
      // Leave is_transaction:true in the query
      return {eventTypes: [EventTypes.TRANSACTION], query};
    }

    return {eventTypes: [EventTypes.TRACE_ITEM_SPAN], query};
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
  getDiscoverDataset: () => DiscoverDatasets.SPANS,
  formatAggregateForTitle: aggregate => {
    if (aggregate.startsWith('count(span.duration)')) {
      return t('Number of spans');
    }
    return aggregate;
  },
};
