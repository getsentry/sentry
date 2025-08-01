import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import type {
  CronDetector,
  CronDetectorUpdatePayload,
} from 'sentry/types/workflowEngine/detectors';
import {getDetectorEnvironment} from 'sentry/views/detectors/utils/getDetectorEnvironment';

interface CronDetectorFormData {
  checkinMargin: number | null;
  environment: string;
  failureIssueThreshold: number;
  maxRuntime: number | null;
  name: string;
  owner: string;

  projectId: string;
  recoveryThreshold: number;
  schedule: string | [number, string]; // Crontab or interval
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
    type: 'uptime_subscription',
    name: data.name,
    owner: data.owner,
    projectId: data.projectId,
    workflowIds: data.workflowIds,
    dataSource: {
      checkinMargin: data.checkinMargin,
      failureIssueThreshold: data.failureIssueThreshold,
      maxRuntime: data.maxRuntime,
      recoveryThreshold: data.recoveryThreshold,
      schedule: data.schedule,
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

  if (dataSource?.type === 'cron_subscription') {
    return {
      ...common,
      checkinMargin: dataSource.queryObj.checkinMargin,
      failureIssueThreshold: dataSource.queryObj.failureIssueThreshold ?? 1,
      recoveryThreshold: dataSource.queryObj.recoveryThreshold ?? 1,
      maxRuntime: dataSource.queryObj.maxRuntime,
      schedule: dataSource.queryObj.schedule,
      scheduleType: dataSource.queryObj.scheduleType,
      timezone: dataSource.queryObj.timezone,
      workflowIds: detector.workflowIds,
    };
  }

  return {
    ...common,
    checkinMargin: null,
    failureIssueThreshold: 1,
    maxRuntime: null,
    recoveryThreshold: 1,
    schedule: '0 0 * * *',
    scheduleType: 'crontab',
    timezone: 'UTC',
    workflowIds: detector.workflowIds,
  };
}
