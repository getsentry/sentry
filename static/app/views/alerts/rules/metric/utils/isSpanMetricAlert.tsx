import {isExtractedCustomMetric} from 'sentry/utils/metrics';
import {isMRI, parseField} from 'sentry/utils/metrics/mri';

/**
 * Currently we can tell if an alert is a custom metric alert by checking the aggregate for a MRI,
 */
export function isSpanMetricAlert(aggregate?: string): boolean {
  if (!aggregate) {
    return false;
  }
  const mri = parseField(aggregate)?.mri;
  return !!mri && isMRI(mri) && isExtractedCustomMetric({mri});
}
