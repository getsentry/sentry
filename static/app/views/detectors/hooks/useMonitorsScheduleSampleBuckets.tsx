import {useMemo} from 'react';

import type {CheckInBucket} from 'sentry/components/checkInTimeline/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {ScheduleType} from 'sentry/views/insights/crons/types';

interface UseMonitorsScheduleSampleBucketsOptions {
  /**
   * The end timestamp of the sample window in seconds
   */
  end: number | undefined;
  /**
   * The interval of the sample window in seconds
   */
  interval: number | undefined;
  /**
   * The start timestamp of the sample window in seconds
   */
  start: number | undefined;
  scheduleType: ScheduleType;
  scheduleCrontab: string;
  scheduleIntervalValue: number;
  scheduleIntervalUnit: string;
  timezone: string;
  failureIssueThreshold: number;
  recoveryThreshold: number;
}

export enum SchedulePreviewStatus {
  OK = 'ok',
  ERROR = 'error',
  SUB_FAILURE_ERROR = 'sub_failure_error',
  SUB_RECOVERY_OK = 'sub_recovery_ok',
}

export function useMonitorsScheduleSampleBuckets({
  start,
  end,
  interval,
  scheduleType,
  scheduleCrontab,
  scheduleIntervalValue,
  scheduleIntervalUnit,
  timezone,
  failureIssueThreshold,
  recoveryThreshold,
}: UseMonitorsScheduleSampleBucketsOptions) {
  const organization = useOrganization();

  const query = useMemo(() => {
    const schedule =
      scheduleType === ScheduleType.INTERVAL
        ? [scheduleIntervalValue, scheduleIntervalUnit]
        : scheduleCrontab;

    return {
      failure_issue_threshold: failureIssueThreshold,
      recovery_threshold: recoveryThreshold,
      schedule_type: scheduleType,
      timezone,
      schedule,
      start,
      end,
      interval,
    };
  }, [
    failureIssueThreshold,
    interval,
    recoveryThreshold,
    scheduleCrontab,
    scheduleIntervalUnit,
    scheduleIntervalValue,
    scheduleType,
    start,
    end,
    timezone,
  ]);

  return useApiQuery<Array<CheckInBucket<SchedulePreviewStatus>>>(
    [`/organizations/${organization.slug}/monitors-schedule-buckets/`, {query}],
    {
      staleTime: 0,
      enabled: !!(start && end && interval && 
        scheduleType && (scheduleCrontab || (scheduleIntervalValue && scheduleIntervalUnit)) 
        && timezone && failureIssueThreshold 
        && recoveryThreshold
      ),
      retry: false,
    }
  );
}
