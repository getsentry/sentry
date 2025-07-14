import type {EventsStats} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ErrorsConfig} from 'sentry/views/dashboards/datasetConfig/errors';
import {EventsSearchBar} from 'sentry/views/detectors/datasetConfig/components/eventSearchBar';
import {
  getDiscoverSeriesQueryOptions,
  transformEventsStatsToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';

import type {DetectorDatasetConfig} from './base';

type ErrorsSeriesResponse = EventsStats;

export const DetectorErrorsConfig: DetectorDatasetConfig<ErrorsSeriesResponse> = {
  defaultField: ErrorsConfig.defaultField,
  getAggregateOptions: ErrorsConfig.getTableFieldOptions,
  SearchBar: EventsSearchBar,
  getSeriesQueryOptions: options =>
    getDiscoverSeriesQueryOptions({
      ...options,
      dataset: DiscoverDatasets.ERRORS,
    }),
  transformSeriesQueryData: (data, aggregate) => {
    return [transformEventsStatsToSeries(data, aggregate)];
  },
};
