import type {
  UptimeDetector,
  UptimeDetectorUpdatePayload,
} from 'sentry/types/workflowEngine/detectors';
import {UptimeMonitorMode} from 'sentry/views/alerts/rules/uptime/types';
import {getDetectorEnvironment} from 'sentry/views/detectors/utils/getDetectorEnvironment';

export const UPTIME_DEFAULT_RECOVERY_THRESHOLD = 1;
export const UPTIME_DEFAULT_DOWNTIME_THRESHOLD = 3;

interface UptimeDetectorFormData {
  body: string;
  description: string | null;
  downtimeThreshold: number;
  environment: string;
  headers: Array<[string, string]>;
  intervalSeconds: number;
  method: string;
  name: string;
  owner: string;
  projectId: string;
  recoveryThreshold: number;
  timeoutMs: number;
  traceSampling: boolean;
  url: string;
  workflowIds: string[];
}

export function uptimeFormDataToEndpointPayload(
  data: UptimeDetectorFormData
): UptimeDetectorUpdatePayload {
  return {
    type: 'uptime_domain_failure',
    name: data.name || 'New Monitor',
    owner: data.owner,
    projectId: data.projectId,
    workflowIds: data.workflowIds,
    description: data.description || null,
    dataSources: [
      {
        intervalSeconds: data.intervalSeconds,
        method: data.method,
        timeoutMs: data.timeoutMs,
        traceSampling: data.traceSampling,
        url: data.url,
        headers: data.headers,
        body: data.body || null,
      },
    ],
    config: {
      mode: UptimeMonitorMode.MANUAL,
      recoveryThreshold: data.recoveryThreshold ?? UPTIME_DEFAULT_RECOVERY_THRESHOLD,
      downtimeThreshold: data.downtimeThreshold ?? UPTIME_DEFAULT_DOWNTIME_THRESHOLD,
      environment: data.environment ? data.environment : null,
    },
  };
}

export function uptimeSavedDetectorToFormData(
  detector: UptimeDetector
): UptimeDetectorFormData {
  const dataSource = detector.dataSources?.[0];
  const environment = getDetectorEnvironment(detector) ?? '';
  const recoveryThreshold =
    detector.config?.recoveryThreshold ?? UPTIME_DEFAULT_RECOVERY_THRESHOLD;
  const downtimeThreshold =
    detector.config?.downtimeThreshold ?? UPTIME_DEFAULT_DOWNTIME_THRESHOLD;

  const common = {
    name: detector.name,
    environment,
    owner: detector.owner ? `${detector.owner?.type}:${detector.owner?.id}` : '',
    projectId: detector.projectId,
    recoveryThreshold,
    downtimeThreshold,
    description: detector.description || null,
  };

  if (dataSource?.type === 'uptime_subscription') {
    return {
      ...common,
      intervalSeconds: dataSource.queryObj.intervalSeconds,
      method: dataSource.queryObj.method,
      timeoutMs: dataSource.queryObj.timeoutMs,
      traceSampling: dataSource.queryObj.traceSampling,
      url: dataSource.queryObj.url,
      headers: dataSource.queryObj.headers,
      body: dataSource.queryObj.body ?? '',
      workflowIds: detector.workflowIds,
    };
  }

  return {
    ...common,
    intervalSeconds: 60,
    method: 'GET',
    timeoutMs: 10000,
    traceSampling: false,
    url: 'https://example.com',
    headers: [],
    body: '',
    workflowIds: detector.workflowIds,
  };
}
