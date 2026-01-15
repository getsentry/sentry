import {useMemo} from 'react';

import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {ScheduleType} from 'sentry/views/insights/crons/types';

export type ScheduleSampleWindowResponse = {
  end: number;
  start: number;
};

interface UseMonitorsScheduleSampleWindowOptions {
  scheduleType: ScheduleType;
  scheduleCrontab: string;
  scheduleIntervalValue: number;
  scheduleIntervalUnit: string;
  timezone: string;
  failureIssueThreshold: number;
  recoveryThreshold: number;
}

export function useMonitorsScheduleSampleWindow({
  scheduleType,
  scheduleCrontab,
  scheduleIntervalValue,
  scheduleIntervalUnit,
  timezone,
  failureIssueThreshold,
  recoveryThreshold,
}: UseMonitorsScheduleSampleWindowOptions) {
  const organization = useOrganization();

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
      enabled: !!(
        scheduleType &&
        (scheduleCrontab || (scheduleIntervalValue && scheduleIntervalUnit)) &&
        timezone &&
        failureIssueThreshold &&
        recoveryThreshold
      ),
      retry: false,
    }
  );
}
