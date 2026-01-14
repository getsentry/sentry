import {useMemo} from 'react';

import type {CheckInBucket} from 'sentry/components/checkInTimeline/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {
  CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD,
  CRON_DEFAULT_RECOVERY_THRESHOLD,
  CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT,
  CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE,
  CRON_DEFAULT_SCHEDULE_TYPE,
  DEFAULT_CRONTAB,
  useCronDetectorFormField,
} from 'sentry/views/detectors/components/forms/cron/fields';
import {ScheduleType} from 'sentry/views/insights/crons/types';

interface UseMonitorsScheduleSampleBucketsOptions {
  end: number | undefined;
  interval: number | undefined;
  start: number | undefined;
}

export enum PreviewStatus {
  OK = 'ok',
  ERROR = 'error',
  SUB_FAILURE_ERROR = 'sub_failure_error',
  SUB_RECOVERY_OK = 'sub_recovery_ok',
}

export function useMonitorsScheduleSampleBuckets({
  start,
  end,
  interval,
}: UseMonitorsScheduleSampleBucketsOptions) {
  const organization = useOrganization();

  // Defaults make this hook easier to use in tests where the form store may not
  // have initialized values yet.
  const scheduleType =
    useCronDetectorFormField('scheduleType') ?? CRON_DEFAULT_SCHEDULE_TYPE;
  const scheduleCrontab = useCronDetectorFormField('scheduleCrontab') ?? DEFAULT_CRONTAB;
  const scheduleIntervalValue =
    useCronDetectorFormField('scheduleIntervalValue') ??
    CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE;
  const scheduleIntervalUnit =
    useCronDetectorFormField('scheduleIntervalUnit') ??
    CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT;
  const timezone = useCronDetectorFormField('timezone') ?? 'UTC';
  const failureIssueThreshold =
    useCronDetectorFormField('failureIssueThreshold') ??
    CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD;
  const recoveryThreshold =
    useCronDetectorFormField('recoveryThreshold') ?? CRON_DEFAULT_RECOVERY_THRESHOLD;

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

  return useApiQuery<Array<CheckInBucket<PreviewStatus>>>(
    [`/organizations/${organization.slug}/monitors-schedule-buckets/`, {query}],
    {
      staleTime: 0,
      enabled: start !== undefined && end !== undefined && interval !== undefined,
      retry: false,
    }
  );
}
