import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {TraceSearchBar} from 'sentry/views/detectors/datasetConfig/components/traceSearchBar';

import type {DetectorDatasetConfig} from './base';

export const DetectorSpansConfig: DetectorDatasetConfig = {
  defaultField: SpansConfig.defaultField,
  getAggregateOptions: SpansConfig.getTableFieldOptions,
  SearchBar: TraceSearchBar,
};
