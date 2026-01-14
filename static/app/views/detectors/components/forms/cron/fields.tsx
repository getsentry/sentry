import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import type {
  CronDetector,
  CronDetectorUpdatePayload,
} from 'sentry/types/workflowEngine/detectors';
import {
  ScheduleType,
  type MonitorConfig,
  type MonitorIntervalUnit,
} from 'sentry/views/insights/crons/types';

const CRON_DEFAULT_TIMEZONE = 'UTC';
export const CRON_DEFAULT_SCHEDULE_TYPE = ScheduleType.CRONTAB;
export const DEFAULT_CRONTAB = '0 0 * * *';
export const CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE = 1;
export const CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT = 'day';

export const CRON_DEFAULT_CHECKIN_MARGIN = 1;
export const CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD = 2;
export const CRON_DEFAULT_RECOVERY_THRESHOLD = 2;

// In minutes
export const CRON_DEFAULT_MAX_RUNTIME = 30;

interface CronDetectorFormData {
  checkinMargin: number | null;
  description: string | null;
  failureIssueThreshold: number;
  maxRuntime: number | null;
  name: string;
  owner: string;
  projectId: string;
  recoveryThreshold: number;
  scheduleCrontab: string;
  scheduleIntervalUnit: MonitorIntervalUnit;
  scheduleIntervalValue: number;
  scheduleType: 'crontab' | 'interval';
  timezone: string;
  workflowIds: string[];
}

type CronDetectorFormFieldName = keyof CronDetectorFormData;

/**
 * Small helper to automatically get the type of the form field.
 */
export function useCronDetectorFormField<T extends CronDetectorFormFieldName>(
  name: T
): CronDetectorFormData[T] {
  const value = useFormField(name);
  return value;
}

export function cronFormDataToEndpointPayload(
  data: CronDetectorFormData
): CronDetectorUpdatePayload {
  const commonConfig = {
    checkin_margin: data.checkinMargin,
    failure_issue_threshold: data.failureIssueThreshold,
    max_runtime: data.maxRuntime,
    recovery_threshold: data.recoveryThreshold,
    timezone: data.timezone,
  };

  const config: MonitorConfig =
    data.scheduleType === 'crontab'
      ? {
          ...commonConfig,
          schedule: data.scheduleCrontab,
          schedule_type: ScheduleType.CRONTAB,
        }
      : {
          ...commonConfig,
          schedule: [data.scheduleIntervalValue, data.scheduleIntervalUnit] as const,
          schedule_type: ScheduleType.INTERVAL,
        };

  const name = data.name || 'New Monitor';
  return {
    type: 'monitor_check_in_failure',
    name,
    description: data.description || null,
    owner: data.owner,
    projectId: data.projectId,
    workflowIds: data.workflowIds,
    dataSources: [
      {
        name,
        config,
      },
    ],
  };
}

export function cronSavedDetectorToFormData(
  detector: CronDetector
): CronDetectorFormData {
  const dataSource = detector.dataSources?.[0];

  const common = {
    name: detector.name,
    owner: detector.owner ? `${detector.owner?.type}:${detector.owner?.id}` : '',
    projectId: detector.projectId,
  };

  const config = dataSource.queryObj.config;

  return {
    ...common,
    checkinMargin: config.checkin_margin,
    failureIssueThreshold: config.failure_issue_threshold ?? 1,
    recoveryThreshold: config.recovery_threshold ?? 1,
    maxRuntime: config.max_runtime,
    scheduleCrontab: Array.isArray(config.schedule) ? DEFAULT_CRONTAB : config.schedule,
    scheduleIntervalValue: Array.isArray(config.schedule)
      ? config.schedule[0]
      : CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE,
    scheduleIntervalUnit: Array.isArray(config.schedule)
      ? config.schedule[1]
      : CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT,
    scheduleType: config.schedule_type ?? CRON_DEFAULT_SCHEDULE_TYPE,
    timezone: config.timezone ?? CRON_DEFAULT_TIMEZONE,
    workflowIds: detector.workflowIds,
    description: detector.description || null,
  };
}
