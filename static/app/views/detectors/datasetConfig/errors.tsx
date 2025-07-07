import {ErrorsConfig} from 'sentry/views/dashboards/datasetConfig/errors';
import {EventsSearchBar} from 'sentry/views/detectors/datasetConfig/components/eventSearchBar';

import type {DetectorDatasetConfig} from './base';

export const DetectorErrorsConfig: DetectorDatasetConfig = {
  defaultField: ErrorsConfig.defaultField,
  getAggregateOptions: ErrorsConfig.getTableFieldOptions,
  SearchBar: EventsSearchBar,
};
