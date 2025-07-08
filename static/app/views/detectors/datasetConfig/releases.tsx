import type {SessionApiResponse} from 'sentry/types/organization';
import {ReleasesConfig} from 'sentry/views/dashboards/datasetConfig/releases';
import {ReleaseSearchBar} from 'sentry/views/detectors/datasetConfig/components/releaseSearchBar';
import {
  getReleasesSeriesQueryOptions,
  transformMetricsResponseToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/releasesSeries';

import type {DetectorDatasetConfig} from './base';

type ReleasesSeriesResponse = SessionApiResponse;

export const DetectorReleasesConfig: DetectorDatasetConfig<ReleasesSeriesResponse> = {
  defaultField: ReleasesConfig.defaultField,
  getAggregateOptions: ReleasesConfig.getTableFieldOptions,
  SearchBar: ReleaseSearchBar,
  getSeriesQueryOptions: getReleasesSeriesQueryOptions,
  transformSeriesQueryData: (data, aggregate) => {
    return [transformMetricsResponseToSeries(data, aggregate)];
  },
};
