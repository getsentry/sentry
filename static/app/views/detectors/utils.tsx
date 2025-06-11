import {t} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';

export function getDetectorTypeLabel(type: DetectorType) {
  switch (type) {
    case 'error':
      return t('Error');
    case 'metric_issue':
      return t('Metric');
    case 'uptime_domain_failure':
      return t('Uptime');
    default:
      return type;
  }
}
