import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

export function isEapDataset(dataset: DetectorDataset): boolean {
  return dataset === DetectorDataset.SPANS || dataset === DetectorDataset.LOGS;
}
