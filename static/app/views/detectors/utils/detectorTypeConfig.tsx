import type {DetectorType} from 'sentry/types/workflowEngine/detectors';

type DetectorTypeConfig = {
  userCreateable: boolean;
};

const DETECTOR_TYPE_CONFIG: Record<DetectorType, DetectorTypeConfig> = {
  error: {
    userCreateable: false,
  },
  metric_issue: {
    userCreateable: true,
  },
  uptime_subscription: {
    userCreateable: true,
  },
  uptime_domain_failure: {
    userCreateable: true,
  },
};

export function isValidDetectorType(detectorType: DetectorType) {
  return DETECTOR_TYPE_CONFIG.hasOwnProperty(detectorType);
}

export function detectorTypeIsUserCreateable(detectorType: DetectorType) {
  return DETECTOR_TYPE_CONFIG[detectorType].userCreateable;
}
