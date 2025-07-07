import {LogsConfig} from 'sentry/views/dashboards/datasetConfig/logs';
import {TraceSearchBar} from 'sentry/views/detectors/datasetConfig/components/traceSearchBar';

import type {DetectorDatasetConfig} from './base';

export const DetectorLogsConfig: DetectorDatasetConfig = {
  defaultField: LogsConfig.defaultField,
  getAggregateOptions: LogsConfig.getTableFieldOptions,
  SearchBar: TraceSearchBar,
};
