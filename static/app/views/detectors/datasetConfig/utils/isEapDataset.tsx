import {DetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';

export function isEapDataset(dataset: DetectorDataset) {
  return dataset === DetectorDataset.SPANS || dataset === DetectorDataset.LOGS;
}
