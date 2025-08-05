import {t} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';

export const DETECTOR_LIST_PAGE_LIMIT = 20;

export const DETECTOR_TYPE_LABELS: Record<DetectorType, string> = {
  metric_issue: t('Metric'),
  uptime_domain_failure: t('Uptime'),
  error: t('Error'),
  uptime_subscription: t('Cron'),
};
