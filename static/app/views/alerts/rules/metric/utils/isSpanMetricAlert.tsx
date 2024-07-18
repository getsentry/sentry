import {isExtractedCustomMetric, isMRI, parseField} from 'sentry/utils/metrics/mri';

/**
 * Currently we can tell if an alert is a span metric alert by checking the aggregate for an MRI
 */
export function isSpanMetricAlert(aggregate?: string): boolean {
  if (!aggregate) {
    return false;
  }
  const mri = parseField(aggregate)?.mri;
  return !!mri && isMRI(mri) && isExtractedCustomMetric({mri});
}
