import type {DetectorType} from 'sentry/types/workflowEngine/detectors';

export function getDetectorTypeLabel(type: DetectorType) {
  switch (type) {
    case 'error':
      return 'Error';
    case 'metric_issue':
      return 'Metric';
    case 'uptime_domain_failure':
      return 'Uptime';
    default:
      return type;
  }
}
