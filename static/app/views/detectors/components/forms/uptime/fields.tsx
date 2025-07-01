import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import type {
  Detector,
  UptimeDetectorUpdatePayload,
} from 'sentry/types/workflowEngine/detectors';

export interface UptimeDetectorFormData {
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
}

type UptimeDetectorFormFieldName = keyof UptimeDetectorFormData;

export interface NewUptimeDetectorPayload
  extends Pick<Detector, 'name' | 'owner' | 'projectId'> {
  dataSource: {
    intervalSeconds: number;
    method: string;
    name: string;
    owner: string;
    timeoutMs: number;
    traceSampling: boolean;
    url: string;
  };
  type: 'uptime_domain_failure';
}

/**
 * Small helper to automatically get the type of the form field.
 */
export function useUptimeDetectorFormField<T extends UptimeDetectorFormFieldName>(
  name: T
): UptimeDetectorFormData[T] {
  const value = useFormField(name);
  return value;
}

/**
 * Enables type-safe form field names.
 * Helps you find areas setting specific fields.
 */
export const UPTIME_DETECTOR_FORM_FIELDS = {
  // Core detector fields
  name: 'name',
  environment: 'environment',
  projectId: 'projectId',
  owner: 'owner',
  intervalSeconds: 'intervalSeconds',
  timeoutMs: 'timeoutMs',
  url: 'url',
  method: 'method',
  traceSampling: 'traceSampling',
  headers: 'headers',
  body: 'body',
} satisfies Record<UptimeDetectorFormFieldName, UptimeDetectorFormFieldName>;

export function uptimeFormDataToEndpointPayload(
  data: UptimeDetectorFormData
): UptimeDetectorUpdatePayload {
  return {
    type: 'uptime_domain_failure',
    name: data.name,
    owner: data.owner,
    projectId: data.projectId,
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
  detector: Detector
): UptimeDetectorFormData {
  const dataSource = detector.dataSources?.[0];
  const environment = 'environment' in detector.config ? detector.config.environment : '';

  const common = {
    name: detector.name,
    environment,
    owner: detector.owner || '',
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
  };
}
