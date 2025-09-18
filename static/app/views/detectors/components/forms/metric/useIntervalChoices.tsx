import {useMemo} from 'react';

import getDuration from 'sentry/utils/duration/getDuration';
import type {MetricDetectorFormData} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

interface UseIntervalChoicesParams {
  dataset: DetectorDataset;
  detectionType: MetricDetectorFormData['detectionType'];
}

export function useIntervalChoices({dataset, detectionType}: UseIntervalChoicesParams) {
  const intervalChoices = useMemo((): Array<[seconds: number, label: string]> => {
    if (!dataset) {
      return [];
    }

    const datasetConfig = getDatasetConfig(dataset);
    const intervals = datasetConfig.getIntervals({detectionType});
    return intervals.map(minutes => {
      const seconds = minutes * 60;
      return [seconds, getDuration(seconds)];
    });
  }, [dataset, detectionType]);

  return intervalChoices;
}
