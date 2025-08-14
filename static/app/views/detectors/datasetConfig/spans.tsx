import type {EventsStats} from 'sentry/types/organization';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {TraceSearchBar} from 'sentry/views/detectors/datasetConfig/components/traceSearchBar';
import {
  getDiscoverSeriesQueryOptions,
  transformEventsStatsComparisonSeries,
  transformEventsStatsToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';

import type {DetectorDatasetConfig} from './base';
import {DEFAULT_EVENT_TYPES_BY_DATASET, parseEventTypesFromQuery} from './eventTypes';
import {DetectorDataset} from './types';

type SpansSeriesResponse = EventsStats;

export const DetectorSpansConfig: DetectorDatasetConfig<SpansSeriesResponse> = {
  defaultField: SpansConfig.defaultField,
  getAggregateOptions: SpansConfig.getTableFieldOptions,
  SearchBar: TraceSearchBar,
  getSeriesQueryOptions: getDiscoverSeriesQueryOptions,
  separateEventTypesFromQuery: query =>
    parseEventTypesFromQuery(
      query,
      DEFAULT_EVENT_TYPES_BY_DATASET[DetectorDataset.SPANS]
    ),
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
