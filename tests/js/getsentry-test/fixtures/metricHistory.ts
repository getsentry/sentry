import {DataCategory} from 'sentry/types/core';

import type {BillingMetricHistory} from 'getsentry/types';

const ORDERED_CATEGORIES = [
  DataCategory.ERRORS,
  DataCategory.TRANSACTIONS,
  DataCategory.REPLAYS,
  DataCategory.SPANS,
  DataCategory.MONITOR_SEATS,
  DataCategory.ATTACHMENTS,
];

export function MetricHistoryFixture(
  params: Partial<BillingMetricHistory>
): BillingMetricHistory {
  const order = params.category
    ? ORDERED_CATEGORIES.indexOf(params.category as DataCategory)
    : 1;
  return {
    category: DataCategory.ERRORS,
    free: 0,
    onDemandBudget: 0,
    onDemandSpendUsed: 0,
    onDemandCpe: 0,
    onDemandQuantity: 0,
    sentUsageWarning: false,
    softCapType: null,
    order,
    prepaid: 5_000,
    reserved: 5_000,
    trueForward: false,
    usage: 0,
    usageExceeded: false,
    customPrice: 0,
    ...params,
  };
}
