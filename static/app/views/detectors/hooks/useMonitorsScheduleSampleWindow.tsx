import {useMemo} from 'react';

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

export type ScheduleSampleWindowResponse = {
  end: number;
  start: number;
};

export function useMonitorsScheduleSampleWindow() {
  const organization = useOrganization();

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

  const query = useMemo(
    () => ({
      failure_issue_threshold: failureIssueThreshold,
      recovery_threshold: recoveryThreshold,
      schedule_type: scheduleType,
      timezone,
      schedule:
        scheduleType === ScheduleType.INTERVAL
          ? [scheduleIntervalValue, scheduleIntervalUnit]
          : scheduleCrontab,
    }),
    [
      failureIssueThreshold,
      recoveryThreshold,
      scheduleCrontab,
      scheduleIntervalUnit,
      scheduleIntervalValue,
      scheduleType,
      timezone,
    ]
  );

  return useApiQuery<ScheduleSampleWindowResponse>(
    [`/organizations/${organization.slug}/monitors-schedule-window/`, {query}],
    {
      staleTime: 0,
      retry: false,
    }
  );
}
