import {t} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';

type DetectorTypeConfig = {
  label: string;
  userCreateable: boolean;
  /**
   * Some detector types have long or confusing type names, so we provide
   * aliases to make the search query more readable.
   *
   * E.g. type:monitor_check_in_failure -> type:cron
   */
  searchAlias?: string;
};

const DETECTOR_TYPE_CONFIG: Record<DetectorType, DetectorTypeConfig> = {
  error: {
    userCreateable: false,
    label: t('Error'),
  },
  metric_issue: {
    searchAlias: 'metric',
    userCreateable: true,
    label: t('Metric'),
  },
  monitor_check_in_failure: {
    searchAlias: 'cron',
    userCreateable: true,
    label: t('Cron'),
  },
  uptime_domain_failure: {
    searchAlias: 'uptime',
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

export function getDetectorTypeSearchAlias(detectorType: DetectorType) {
  return DETECTOR_TYPE_CONFIG[detectorType].searchAlias ?? detectorType;
}

export function getAllDetectorTypes(): DetectorType[] {
  return Object.keys(DETECTOR_TYPE_CONFIG) as DetectorType[];
}
