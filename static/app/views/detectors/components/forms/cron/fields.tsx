import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import type {
  CronDetector,
  CronDetectorUpdatePayload,
} from 'sentry/types/workflowEngine/detectors';
import {getDetectorEnvironment} from 'sentry/views/detectors/utils/getDetectorEnvironment';
import {ScheduleType} from 'sentry/views/insights/crons/types';

export const CRON_DEFAULT_SCHEDULE_TYPE = ScheduleType.CRONTAB;
export const DEFAULT_CRONTAB = '0 0 * * *';
export const CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE = 1;
export const CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT = 'day';

export const CRON_DEFAULT_CHECKIN_MARGIN = 1;
export const CRON_DEFAULT_FAILURE_ISSUE_THRESHOLD = 1;
export const CRON_DEFAULT_RECOVERY_THRESHOLD = 1;

// In minutes
export const CRON_DEFAULT_MAX_RUNTIME = 30;

interface CronDetectorFormData {
  checkinMargin: number | null;
  environment: string;
  failureIssueThreshold: number;
  maxRuntime: number | null;
  name: string;
  owner: string;

  projectId: string;
  recoveryThreshold: number;
  scheduleCrontab: string;
  scheduleIntervalUnit: string;
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
  return {
    type: 'monitor_check_in_failure',
    name: data.name,
    owner: data.owner,
    projectId: data.projectId,
    workflowIds: data.workflowIds,
    dataSource: {
      checkinMargin: data.checkinMargin,
      failureIssueThreshold: data.failureIssueThreshold,
      maxRuntime: data.maxRuntime,
      recoveryThreshold: data.recoveryThreshold,
      schedule:
        data.scheduleType === 'crontab'
          ? data.scheduleCrontab
          : [data.scheduleIntervalValue, data.scheduleIntervalUnit],
      scheduleType: data.scheduleType,
      timezone: data.timezone,
    },
    config: {
      environment: data.environment,
    },
  };
}

export function cronSavedDetectorToFormData(
  detector: CronDetector
): CronDetectorFormData {
  const dataSource = detector.dataSources?.[0];
  const environment = getDetectorEnvironment(detector) ?? '';

  const common = {
    name: detector.name,
    environment,
    owner: detector.owner || '',
    projectId: detector.projectId,
  };

  return {
    ...common,
    checkinMargin: dataSource.queryObj.checkinMargin,
    failureIssueThreshold: dataSource.queryObj.failureIssueThreshold ?? 1,
    recoveryThreshold: dataSource.queryObj.recoveryThreshold ?? 1,
    maxRuntime: dataSource.queryObj.maxRuntime,
    scheduleCrontab: Array.isArray(dataSource.queryObj.schedule)
      ? DEFAULT_CRONTAB
      : dataSource.queryObj.schedule,
    scheduleIntervalValue: Array.isArray(dataSource.queryObj.schedule)
      ? dataSource.queryObj.schedule[0]
      : CRON_DEFAULT_SCHEDULE_INTERVAL_VALUE,
    scheduleIntervalUnit: Array.isArray(dataSource.queryObj.schedule)
      ? dataSource.queryObj.schedule[1]
      : CRON_DEFAULT_SCHEDULE_INTERVAL_UNIT,
    scheduleType: dataSource.queryObj.scheduleType,
    timezone: dataSource.queryObj.timezone,
    workflowIds: detector.workflowIds,
  };
}
