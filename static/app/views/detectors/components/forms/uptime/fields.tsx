import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import type {
  UptimeDetector,
  UptimeDetectorUpdatePayload,
} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {createEmptyAssertionRoot} from 'sentry/views/alerts/rules/uptime/assertions/field';
import type {Assertion} from 'sentry/views/alerts/rules/uptime/types';
import {UptimeMonitorMode} from 'sentry/views/alerts/rules/uptime/types';
import {getDetectorEnvironment} from 'sentry/views/detectors/utils/getDetectorEnvironment';

export const UPTIME_DEFAULT_RECOVERY_THRESHOLD = 1;
export const UPTIME_DEFAULT_DOWNTIME_THRESHOLD = 3;

interface UptimeDetectorFormData {
  assertion: Assertion | null;
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

type UptimeDetectorFormFieldName = keyof UptimeDetectorFormData;

const DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP: {
  [K in UptimeDetectorFormFieldName]: UptimeDetectorFormData[K];
} = {
  assertion: null,
  body: '',
  description: null,
  downtimeThreshold: UPTIME_DEFAULT_DOWNTIME_THRESHOLD,
  environment: '',
  headers: [],
  intervalSeconds: 60,
  method: 'GET',
  name: '',
  owner: '',
  projectId: '',
  recoveryThreshold: UPTIME_DEFAULT_RECOVERY_THRESHOLD,
  timeoutMs: 5000,
  traceSampling: false,
  url: '',
  workflowIds: [],
};

/**
 * Small helper to automatically get the type of the form field.
 */
export function useUptimeDetectorFormField<T extends UptimeDetectorFormFieldName>(
  name: T
): UptimeDetectorFormData[T] {
  const value = useFormField(name);

  if (value === '' || !defined(value)) {
    return DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP[name];
  }

  return value;
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
        assertion: data.assertion,
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
      // Use empty assertion structure for null - FormField converts null to '' which
      // we can't distinguish from "new form". Empty children signals "edit with no assertions".
      assertion: dataSource.queryObj.assertion ?? {root: createEmptyAssertionRoot()},
      workflowIds: detector.workflowIds,
    };
  }

  return {
    ...common,
    intervalSeconds: DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.intervalSeconds,
    method: DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.method,
    timeoutMs: DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.timeoutMs,
    traceSampling: DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.traceSampling,
    url: 'https://example.com',
    headers: DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.headers,
    body: DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.body,
    // Use empty assertion structure for consistency with the main case above.
    // null would cause a crash in getValue when accessing value.root.children.length
    assertion: {root: createEmptyAssertionRoot()},
    workflowIds: detector.workflowIds,
  };
}
