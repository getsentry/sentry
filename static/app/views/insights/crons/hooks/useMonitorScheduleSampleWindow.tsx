import type {FieldValue} from 'sentry/components/forms/model';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {ScheduleType} from 'sentry/views/insights/crons/types';

interface ScheduleConfig {
  cronSchedule?: FieldValue;
  intervalFrequency?: FieldValue;
  intervalUnit?: FieldValue;
  scheduleType?: FieldValue;
  timezone?: string;
}

export type ScheduleSampleWindowResponse = {
  end: number;
  start: number;
};

export const DEFAULT_SCHEDULE_SAMPLE_THRESHOLDS = {
  failureIssueThreshold: 720,
  recoveryThreshold: 720,
} as const;

function isValidConfig(schedule: ScheduleConfig) {
  const {scheduleType, cronSchedule, intervalFrequency, intervalUnit} = schedule;
  return !!(
    (scheduleType === ScheduleType.CRONTAB && cronSchedule) ||
    (scheduleType === ScheduleType.INTERVAL && intervalFrequency && intervalUnit)
  );
}

export function useMonitorScheduleSampleWindow(
  organization: Organization,
  schedule: ScheduleConfig
) {
  const {scheduleType, cronSchedule, timezone, intervalFrequency, intervalUnit} =
    schedule;

  const query = {
    // Hard-coded thresholds for now (debugging / wiring the endpoint)
    failure_issue_threshold: DEFAULT_SCHEDULE_SAMPLE_THRESHOLDS.failureIssueThreshold,
    recovery_threshold: DEFAULT_SCHEDULE_SAMPLE_THRESHOLDS.recoveryThreshold,
    schedule_type: scheduleType,
    timezone,
    schedule:
      scheduleType === ScheduleType.INTERVAL
        ? [intervalFrequency, intervalUnit]
        : cronSchedule,
  };

  return useApiQuery<ScheduleSampleWindowResponse>(
    [`/organizations/${organization.slug}/monitors-schedule-window/`, {query}],
    {
      staleTime: 0,
      enabled: isValidConfig(schedule),
      retry: false,
    }
  );
}
