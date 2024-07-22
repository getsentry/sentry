import {isMRI, parseField} from 'sentry/utils/metrics/mri';

/**
 * Currently we can tell if an alert is a custom metric alert by checking the aggregate for a MRI,
 */
export function isCustomMetricAlert(aggregate: string): boolean {
  return isMRI(parseField(aggregate)?.mri);
}
