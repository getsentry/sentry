import {useMemo} from 'react';

import getDuration from 'sentry/utils/duration/getDuration';
import {TimeWindow} from 'sentry/views/alerts/rules/metric/types';
import type {MetricDetectorFormData} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {isEapDataset} from 'sentry/views/detectors/datasetConfig/utils/isEapDataset';

const baseIntervals: TimeWindow[] = [
  TimeWindow.ONE_MINUTE,
  TimeWindow.FIVE_MINUTES,
  TimeWindow.TEN_MINUTES,
  TimeWindow.FIFTEEN_MINUTES,
  TimeWindow.THIRTY_MINUTES,
  TimeWindow.ONE_HOUR,
  TimeWindow.TWO_HOURS,
  TimeWindow.FOUR_HOURS,
  TimeWindow.ONE_DAY,
];

const dynamicIntervalChoices: TimeWindow[] = [
  TimeWindow.FIFTEEN_MINUTES,
  TimeWindow.THIRTY_MINUTES,
  TimeWindow.ONE_HOUR,
];

interface UseIntervalChoicesParams {
  dataset: DetectorDataset;
  detectionType: MetricDetectorFormData['detectionType'];
}

export function useIntervalChoices({dataset, detectionType}: UseIntervalChoicesParams) {
  const intervalChoices = useMemo((): Array<[seconds: number, label: string]> => {
    if (!dataset) {
      return [];
    }

    // Interval filtering rules:
    // 1. Releases → No sub-hour intervals (crash-free alert behavior)
    // 2. Dynamic detection → Only 15min, 30min, 1hour
    // 3. Spans/Logs → No 1-minute intervals (EAP dataset behavior)
    // 4. Everything else → All intervals allowed
    const shouldExcludeSubHour = dataset === DetectorDataset.RELEASES;
    const isDynamicDetection = detectionType === 'dynamic';

    const filteredIntervals = baseIntervals.filter(timeWindow => {
      if (shouldExcludeSubHour) {
        return timeWindow >= TimeWindow.ONE_HOUR;
      }
      if (isDynamicDetection) {
        return dynamicIntervalChoices.includes(timeWindow);
      }
      // EAP-derived datasets (spans, logs) exclude 1-minute intervals
      if (isEapDataset(dataset)) {
        return timeWindow !== TimeWindow.ONE_MINUTE;
      }
      return true;
    });

    return filteredIntervals.map(timeWindow => {
      const seconds = timeWindow * 60;
      return [seconds, getDuration(seconds)];
    });
  }, [dataset, detectionType]);

  return intervalChoices;
}
