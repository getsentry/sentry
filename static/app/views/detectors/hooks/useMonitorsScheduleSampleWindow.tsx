import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
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

  return useQuery({
    ...apiOptions.as<ScheduleSampleWindowResponse>()(
      '/organizations/$organizationIdOrSlug/monitors-schedule-window/',
      {path: {organizationIdOrSlug: organization.slug}, query, staleTime: 0}
    ),
    retry: false,
  });
}
