import type {
  UptimeDetector,
  UptimeDetectorUpdatePayload,
} from 'sentry/types/workflowEngine/detectors';
import {getDetectorEnvironment} from 'sentry/views/detectors/utils/getDetectorEnvironment';

interface UptimeDetectorFormData {
  body: string;
  environment: string;
  headers: Array<[string, string]>;
  intervalSeconds: number;
  method: string;
  name: string;
  owner: string;
  projectId: string;
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
    name: data.name,
    owner: data.owner,
    projectId: data.projectId,
    workflowIds: data.workflowIds,
    dataSource: {
      intervalSeconds: data.intervalSeconds,
      method: data.method,
      timeoutMs: data.timeoutMs,
      traceSampling: data.traceSampling,
      url: data.url,
    },
  };
}

export function uptimeSavedDetectorToFormData(
  detector: UptimeDetector
): UptimeDetectorFormData {
  const dataSource = detector.dataSources?.[0];
  const environment = getDetectorEnvironment(detector) ?? '';

  const common = {
    name: detector.name,
    environment,
    owner: detector.owner ? `${detector.owner?.type}:${detector.owner?.id}` : '',
    projectId: detector.projectId,
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
