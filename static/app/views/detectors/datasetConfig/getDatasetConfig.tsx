import {DetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {DetectorErrorsConfig} from 'sentry/views/detectors/datasetConfig/errors';
import {DetectorLogsConfig} from 'sentry/views/detectors/datasetConfig/logs';
import {DetectorReleasesConfig} from 'sentry/views/detectors/datasetConfig/releases';
import {DetectorSpansConfig} from 'sentry/views/detectors/datasetConfig/spans';
import {DetectorTransactionsConfig} from 'sentry/views/detectors/datasetConfig/transactions';

const DATASET_CONFIG_MAP = {
  [DetectorDataset.ERRORS]: DetectorErrorsConfig,
  [DetectorDataset.TRANSACTIONS]: DetectorTransactionsConfig,
  [DetectorDataset.RELEASES]: DetectorReleasesConfig,
  [DetectorDataset.SPANS]: DetectorSpansConfig,
  [DetectorDataset.LOGS]: DetectorLogsConfig,
} as const satisfies Record<DetectorDataset, any>;

export function getDatasetConfig<T extends DetectorDataset>(
  dataset: T
): (typeof DATASET_CONFIG_MAP)[T] {
  return DATASET_CONFIG_MAP[dataset];
}
