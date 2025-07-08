import {TransactionsConfig} from 'sentry/views/dashboards/datasetConfig/transactions';
import {EventsSearchBar} from 'sentry/views/detectors/datasetConfig/components/eventSearchBar';

import type {DetectorDatasetConfig} from './base';

export const DetectorTransactionsConfig: DetectorDatasetConfig = {
  defaultField: TransactionsConfig.defaultField,
  getAggregateOptions: TransactionsConfig.getTableFieldOptions,
  SearchBar: EventsSearchBar,
};
