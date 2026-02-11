import {t} from 'sentry/locale';
import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';
import {UptimeMonitorMode} from 'sentry/views/alerts/rules/uptime/types';

type DetectorTypeConfig = {
  label: string;
  userCreateable: boolean;
  path?: string;
  systemCreatedNotice?: (detector: Detector) => undefined | string;
};

const DETECTOR_TYPE_CONFIG: Record<DetectorType, DetectorTypeConfig> = {
  error: {
    label: t('Error'),
    path: 'errors',
    userCreateable: false,
    systemCreatedNotice: () => t('This monitor is managed by Sentry'),
  },
  metric_issue: {
    label: t('Metric'),
    path: 'metrics',
    userCreateable: true,
  },
  monitor_check_in_failure: {
    label: t('Cron'),
    path: 'crons',
    userCreateable: true,
  },
  uptime_domain_failure: {
    label: t('Uptime'),
    path: 'uptime',
    userCreateable: true,
    systemCreatedNotice: uptimeDetector =>
      uptimeDetector.type === 'uptime_domain_failure' &&
      uptimeDetector.config.mode !== UptimeMonitorMode.MANUAL
        ? t('This Uptime Monitor was auto-detected by Sentry')
        : undefined,
  },
  issue_stream: {
    userCreateable: false,
    label: t('Issue Stream'),
    systemCreatedNotice: () => t('This monitor is managed by Sentry'),
  },
};

export function isValidDetectorType(detectorType: DetectorType) {
  return DETECTOR_TYPE_CONFIG.hasOwnProperty(detectorType);
}

export function detectorTypeIsUserCreateable(detectorType: DetectorType) {
  return DETECTOR_TYPE_CONFIG[detectorType]?.userCreateable ?? false;
}

export function getDetectorSystemCreatedNotice(detector: Detector) {
  return DETECTOR_TYPE_CONFIG[detector.type]?.systemCreatedNotice?.(detector);
}

export function getDetectorTypeLabel(detectorType: DetectorType) {
  return DETECTOR_TYPE_CONFIG[detectorType]?.label ?? 'Unknown';
}

export function getDetectorTypePath(detectorType: DetectorType) {
  return DETECTOR_TYPE_CONFIG[detectorType]?.path;
}
