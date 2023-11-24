import {getMRIAndOp} from 'sentry/utils/metrics/mri';

/**
 * Currently we can tell if an alert is a crash free alert by checking the aggregate for a MRI,
 */
export function isCustomMetricAlert(aggregate: string): boolean {
  return Boolean(getMRIAndOp(aggregate)?.mri);
}
