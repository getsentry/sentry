import type {EventsStats} from 'sentry/types/organization';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {TraceSearchBar} from 'sentry/views/detectors/datasetConfig/components/traceSearchBar';
import {
  getDiscoverSeriesQueryOptions,
  transformEventsStatsToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';

import type {DetectorDatasetConfig} from './base';

type SpansSeriesResponse = EventsStats;

export const DetectorSpansConfig: DetectorDatasetConfig<SpansSeriesResponse> = {
  defaultField: SpansConfig.defaultField,
  getAggregateOptions: SpansConfig.getTableFieldOptions,
  SearchBar: TraceSearchBar,
  getSeriesQueryOptions: getDiscoverSeriesQueryOptions,
  transformSeriesQueryData: (data: SpansSeriesResponse, aggregate: string) => [
    transformEventsStatsToSeries(data, aggregate),
  ],
};
