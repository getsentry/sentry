import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';

interface UptimeDetectorFormData {
  environment: string;
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
} satisfies Record<UptimeDetectorFormFieldName, UptimeDetectorFormFieldName>;
