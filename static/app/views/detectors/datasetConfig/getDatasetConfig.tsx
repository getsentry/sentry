import {DetectorErrorsConfig} from './errors';
import {DetectorLogsConfig} from './logs';
import {DetectorMetricsConfig} from './metrics';
import {DetectorReleasesConfig} from './releases';
import {DetectorSpansConfig} from './spans';
import {DetectorTransactionsConfig} from './transactions';
import {DetectorDataset} from './types';

const DATASET_CONFIG_MAP = {
  [DetectorDataset.ERRORS]: DetectorErrorsConfig,
  [DetectorDataset.TRANSACTIONS]: DetectorTransactionsConfig,
  [DetectorDataset.RELEASES]: DetectorReleasesConfig,
  [DetectorDataset.SPANS]: DetectorSpansConfig,
  [DetectorDataset.LOGS]: DetectorLogsConfig,
  [DetectorDataset.METRICS]: DetectorMetricsConfig,
} as const satisfies Record<DetectorDataset, any>;

export function getDatasetConfig<T extends DetectorDataset>(
  dataset: T
): (typeof DATASET_CONFIG_MAP)[T] {
  return DATASET_CONFIG_MAP[dataset];
}
