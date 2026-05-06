import {z} from 'zod';

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
export const CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD = 1;
export const CRON_DEFAULT_RECOVERY_THRESHOLD = 1;

// In minutes
export const CRON_DEFAULT_MAX_RUNTIME = 30;

export const cronDetectorFormSchema = z.object({
  name: z.string(),
  projectId: z.string().min(1),
  owner: z.string().nullable(),
  description: z.string().nullable(),
  scheduleType: z.nativeEnum(ScheduleType),
  scheduleCrontab: z.string().min(1),
  scheduleIntervalValue: z.number().min(1),
  scheduleIntervalUnit: z.string(),
  timezone: z.string().min(1),
  checkinMargin: z.number().min(1).nullable(),
  maxRuntime: z.number().min(1).nullable(),
  failureIssueThreshold: z.number().min(1).max(720),
  recoveryThreshold: z.number().min(1),
  workflowIds: z.array(z.string()),
});

export type CronDetectorFormValues = z.input<typeof cronDetectorFormSchema>;

export const CRON_DEFAULT_FORM_VALUES: CronDetectorFormValues = {
  checkinMargin: CRON_DEFAULT_CHECKIN_MARGIN,
  description: null,
  failureIssueThreshold: CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD,
  maxRuntime: CRON_DEFAULT_MAX_RUNTIME,
  name: '',
  owner: null,
  projectId: '',
  recoveryThreshold: CRON_DEFAULT_RECOVERY_THRESHOLD,
  scheduleCrontab: DEFAULT_CRONTAB,
  scheduleIntervalUnit: CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT,
  scheduleIntervalValue: CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE,
  scheduleType: CRON_DEFAULT_SCHEDULE_TYPE,
  timezone: CRON_DEFAULT_TIMEZONE,
  workflowIds: [],
};

export function cronFormDataToEndpointPayload(
  data: CronDetectorFormValues
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
          schedule: [
            data.scheduleIntervalValue,
            data.scheduleIntervalUnit as MonitorIntervalUnit,
          ] as const,
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
): CronDetectorFormValues {
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
