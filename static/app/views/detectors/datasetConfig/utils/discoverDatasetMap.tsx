import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {DetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';

export const DETECTOR_DATASET_TO_DISCOVER_DATASET_MAP: Record<
  DetectorDataset,
  DiscoverDatasets
> = {
  [DetectorDataset.ERRORS]: DiscoverDatasets.ERRORS,
  [DetectorDataset.TRANSACTIONS]: DiscoverDatasets.TRANSACTIONS,
  [DetectorDataset.SPANS]: DiscoverDatasets.SPANS_EAP,
  [DetectorDataset.LOGS]: DiscoverDatasets.OURLOGS,
  [DetectorDataset.RELEASES]: DiscoverDatasets.DISCOVER,
};
