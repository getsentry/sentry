import {ReleasesConfig} from 'sentry/views/dashboards/datasetConfig/releases';
import {ReleaseSearchBar} from 'sentry/views/detectors/datasetConfig/components/releaseSearchBar';

import type {DetectorDatasetConfig} from './base';

export const DetectorReleasesConfig: DetectorDatasetConfig = {
  defaultField: ReleasesConfig.defaultField,
  getAggregateOptions: ReleasesConfig.getTableFieldOptions,
  SearchBar: ReleaseSearchBar,
};
