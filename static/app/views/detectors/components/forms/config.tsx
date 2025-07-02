import type {
  BaseDetectorUpdatePayload,
  Detector,
  DetectorType,
  MetricDetectorUpdatePayload,
  UptimeDetectorUpdatePayload,
} from 'sentry/types/workflowEngine/detectors';
import type {MetricDetectorFormData} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {
  DEFAULT_THRESHOLD_METRIC_FORM_DATA,
  metricDetectorFormDataToEndpointPayload,
  metricSavedDetectorToFormData,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import type {UptimeDetectorFormData} from 'sentry/views/detectors/components/forms/uptime/fields';
import {
  uptimeFormDataToEndpointPayload,
  uptimeSavedDetectorToFormData,
} from 'sentry/views/detectors/components/forms/uptime/fields';

type DetectorTypeConfigValue<
  TFormData extends Record<string, any>,
  TEndpointPayload extends BaseDetectorUpdatePayload,
> = {
  /**
   * Used to convert from the form data to the endpoint payload for creating or updating a detector
   */
  formDataToEndpointPayload: (formData: TFormData) => TEndpointPayload;
  /**
   * Used to populate initial form data when creating a new detector. Default values can be provided
   * here or in the form components themselves.
   */
  getInitialFormData: () => Partial<TFormData>;
  /**
   * Used to convert the endpoint response to form data for editing.
   */
  savedDetectorToFormData: (detector: Detector) => TFormData;
};

const METRIC_ISSUE_CONFIG: DetectorTypeConfigValue<
  MetricDetectorFormData,
  MetricDetectorUpdatePayload
> = {
  formDataToEndpointPayload: metricDetectorFormDataToEndpointPayload,
  savedDetectorToFormData: metricSavedDetectorToFormData,
  getInitialFormData: () => DEFAULT_THRESHOLD_METRIC_FORM_DATA,
};

const UPTIME_DOMAIN_FAILURE_CONFIG: DetectorTypeConfigValue<
  UptimeDetectorFormData,
  UptimeDetectorUpdatePayload
> = {
  formDataToEndpointPayload: uptimeFormDataToEndpointPayload,
  savedDetectorToFormData: uptimeSavedDetectorToFormData,
  getInitialFormData: () => ({}),
};

export type EditableDetectorType = Exclude<DetectorType, 'error' | 'uptime_subscription'>;
export const DETECTOR_FORM_CONFIG = {
  metric_issue: METRIC_ISSUE_CONFIG,
  uptime_domain_failure: UPTIME_DOMAIN_FAILURE_CONFIG,
} satisfies Record<EditableDetectorType, DetectorTypeConfigValue<any, any>>;

export type DetectorFormData = ReturnType<
  (typeof DETECTOR_FORM_CONFIG)[keyof typeof DETECTOR_FORM_CONFIG]['savedDetectorToFormData']
>;

export type DetectorUpdatePayload = ReturnType<
  (typeof DETECTOR_FORM_CONFIG)[keyof typeof DETECTOR_FORM_CONFIG]['formDataToEndpointPayload']
>;

export function canEditDetector(
  detectorType: DetectorType
): detectorType is EditableDetectorType {
  return Object.hasOwn(DETECTOR_FORM_CONFIG, detectorType);
}
