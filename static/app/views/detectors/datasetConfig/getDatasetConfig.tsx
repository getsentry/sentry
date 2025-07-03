import {unreachable} from 'sentry/utils/unreachable';
import {DetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import type {DetectorDatasetConfig} from 'sentry/views/detectors/datasetConfig/base';
import {DetectorErrorsConfig} from 'sentry/views/detectors/datasetConfig/errors';
import {DetectorLogsConfig} from 'sentry/views/detectors/datasetConfig/logs';
import {DetectorReleasesConfig} from 'sentry/views/detectors/datasetConfig/releases';
import {DetectorSpansConfig} from 'sentry/views/detectors/datasetConfig/spans';
import {DetectorTransactionsConfig} from 'sentry/views/detectors/datasetConfig/transactions';

export function getDatasetConfig(dataset: DetectorDataset): DetectorDatasetConfig {
  switch (dataset) {
    case DetectorDataset.ERRORS:
      return DetectorErrorsConfig;
    case DetectorDataset.TRANSACTIONS:
      return DetectorTransactionsConfig;
    case DetectorDataset.RELEASES:
      return DetectorReleasesConfig;
    case DetectorDataset.SPANS:
      return DetectorSpansConfig;
    case DetectorDataset.LOGS:
      return DetectorLogsConfig;
    default:
      unreachable(dataset);
      return DetectorErrorsConfig;
  }
}
