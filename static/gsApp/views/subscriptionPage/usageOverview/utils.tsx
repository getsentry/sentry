import {LineItemTag, type BillingMetricHistory} from 'getsentry/types';

/**
 * Token-billed Seer usage is broken down per feature on the Seer usage stats
 * page, so the usage overview doesn't list it as a product.
 */
export function isShownInUsageOverview(
  metricHistory: BillingMetricHistory | undefined
): boolean {
  return !metricHistory?.tags?.includes(LineItemTag.GEN_AI_USAGE);
}
