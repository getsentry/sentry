import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {ScheduleType} from 'sentry/views/insights/crons/types';

import type {UseMonitorsScheduleSamplesOptions} from './useMonitorsScheduleSamples';

type ScheduleSampleWindowResponse = {
  end: number;
  start: number;
};

export function useMonitorsScheduleSampleWindow({
  schedule,
  timezone,
  failureIssueThreshold,
  recoveryThreshold,
}: UseMonitorsScheduleSamplesOptions) {
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
  };

  return useApiQuery<ScheduleSampleWindowResponse>(
    [`/organizations/${organization.slug}/monitors-schedule-window/`, {query}],
    {
      staleTime: 0,
      retry: false,
    }
  );
}
