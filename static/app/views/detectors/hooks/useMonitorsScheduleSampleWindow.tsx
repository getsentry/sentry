import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

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
  const scheduleValue = schedule.unit ? [schedule.value, schedule.unit] : schedule.value;

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
