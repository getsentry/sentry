import {useMemo, useRef} from 'react';

import {getConfigFromTimeRange} from 'sentry/components/checkInTimeline/utils/getConfigFromTimeRange';
import {useDimensions} from 'sentry/utils/useDimensions';
import type {MonitorIntervalUnit, ScheduleType} from 'sentry/views/insights/crons/types';

import {useMonitorsScheduleSampleBuckets} from './useMonitorsScheduleSampleBuckets';
import {useMonitorsScheduleSampleWindow} from './useMonitorsScheduleSampleWindow';

export type Schedule =
  | {
      type: ScheduleType.CRONTAB;
      value: string;
    }
  | {
      type: ScheduleType.INTERVAL;
      unit: MonitorIntervalUnit;
      value: number;
    };

export interface UseMonitorsScheduleSamplesOptions {
  failureIssueThreshold: number;
  recoveryThreshold: number;
  schedule: Schedule;
  timezone: string;
}

export function useMonitorsScheduleSamples({
  ...detectorFields
}: UseMonitorsScheduleSamplesOptions) {
  const timeLineWidthTrackerRef = useRef<HTMLDivElement>(null);
  const {width: timelineWidth} = useDimensions<HTMLDivElement>({
    elementRef: timeLineWidthTrackerRef,
  });

  const {
    data: sampleWindowData,
    isLoading: isLoadingSampleWindow,
    error: errorSampleWindow,
  } = useMonitorsScheduleSampleWindow(detectorFields);

  const timeWindowConfig = sampleWindowData
    ? getConfigFromTimeRange(
        new Date(sampleWindowData.start * 1000),
        new Date(sampleWindowData.end * 1000),
        timelineWidth,
        detectorFields.timezone
      )
    : undefined;

  const start = timeWindowConfig?.start;
  const end = timeWindowConfig?.end;
  const interval = timeWindowConfig?.rollupConfig.interval;

  const {
    data: sampleBucketsData,
    isLoading: isLoadingSampleBuckets,
    error: errorSampleBuckets,
  } = useMonitorsScheduleSampleBuckets({
    start: start ? start.getTime() / 1000 : undefined,
    end: end ? end.getTime() / 1000 : undefined,
    interval: interval ?? undefined,
    ...detectorFields,
  });

  const result = useMemo(() => {
    return {
      timeWindowConfig,
      timeLineWidthTrackerRef,
      samples: sampleBucketsData,
      isLoading: isLoadingSampleWindow || isLoadingSampleBuckets,
      errors: [errorSampleWindow, errorSampleBuckets].filter(error => error !== null),
    };
  }, [
    sampleBucketsData,
    isLoadingSampleWindow,
    isLoadingSampleBuckets,
    timeLineWidthTrackerRef,
    errorSampleWindow,
    errorSampleBuckets,
    timeWindowConfig,
  ]);

  return result;
}
