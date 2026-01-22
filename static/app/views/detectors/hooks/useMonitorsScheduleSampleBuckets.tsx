import type {CheckInBucket} from 'sentry/components/checkInTimeline/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {ScheduleType} from 'sentry/views/insights/crons/types';

import type {UseMonitorsScheduleSamplesOptions} from './useMonitorsScheduleSamples';

interface UseMonitorsScheduleSampleBucketsOptions
  extends UseMonitorsScheduleSamplesOptions {
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
  schedule,
  timezone,
  failureIssueThreshold,
  recoveryThreshold,
}: UseMonitorsScheduleSampleBucketsOptions) {
  const organization = useOrganization();

  const scheduleType = schedule.type;
  const scheduleValue =
    scheduleType === ScheduleType.INTERVAL
      ? [schedule.value, schedule.unit]
      : schedule.value;

  const query = {
    failure_issue_threshold: failureIssueThreshold,
    recovery_threshold: recoveryThreshold,
    timezone,
    schedule: scheduleValue,
    schedule_type: scheduleType,
    start,
    end,
    interval,
  };

  return useApiQuery<Array<CheckInBucket<SchedulePreviewStatus>>>(
    [`/organizations/${organization.slug}/monitors-schedule-buckets/`, {query}],
    {
      staleTime: 0,
      enabled: !!(start && end && interval),
      retry: false,
    }
  );
}
