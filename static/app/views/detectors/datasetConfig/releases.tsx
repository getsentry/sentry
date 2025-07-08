import type {SessionApiResponse} from 'sentry/types/organization';
import {ReleasesConfig} from 'sentry/views/dashboards/datasetConfig/releases';
import {TraceSearchBar} from 'sentry/views/detectors/datasetConfig/components/traceSearchBar';
import {
  getReleasesSeriesQueryOptions,
  transformMetricsResponseToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/releasesSeries';

import type {DetectorDatasetConfig} from './base';

type ReleasesSeriesResponse = SessionApiResponse;

export const DetectorReleasesConfig: DetectorDatasetConfig<ReleasesSeriesResponse> = {
  defaultField: ReleasesConfig.defaultField,
  getAggregateOptions: ReleasesConfig.getTableFieldOptions,
  SearchBar: TraceSearchBar,
  getSeriesQueryOptions: getReleasesSeriesQueryOptions,
  transformSeriesQueryData: (data: ReleasesSeriesResponse, aggregate: string) => [
    transformMetricsResponseToSeries(data, aggregate),
  ],
};
