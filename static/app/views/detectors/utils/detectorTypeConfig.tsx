import {t} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';

type DetectorTypeConfig = {
  label: string;
  userCreateable: boolean;
};

const DETECTOR_TYPE_CONFIG: Record<DetectorType, DetectorTypeConfig> = {
  error: {
    userCreateable: false,
    label: t('Error'),
  },
  metric_issue: {
    userCreateable: true,
    label: t('Metric'),
  },
  monitor_check_in_failure: {
    userCreateable: true,
    label: t('Cron'),
  },
  uptime_domain_failure: {
    userCreateable: true,
    label: t('Uptime'),
  },
};

export function isValidDetectorType(detectorType: DetectorType) {
  return DETECTOR_TYPE_CONFIG.hasOwnProperty(detectorType);
}

export function detectorTypeIsUserCreateable(detectorType: DetectorType) {
  return DETECTOR_TYPE_CONFIG[detectorType].userCreateable ?? false;
}

export function getDetectorTypeLabel(detectorType: DetectorType) {
  return DETECTOR_TYPE_CONFIG[detectorType].label ?? 'Unknown';
}
