import {parseField} from 'sentry/utils/metrics/mri';

/**
 * Currently we can tell if an alert is a crash free alert by checking the aggregate for a MRI,
 */
export function isCustomMetricAlert(aggregate: string): boolean {
  return Boolean(parseField(aggregate)?.mri);
}
