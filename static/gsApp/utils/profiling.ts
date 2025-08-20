import {DataCategory} from 'sentry/types/core';

import type {BillingMetricHistory, Subscription} from 'getsentry/types';

export function hasBudgetFor(
  subscription: Subscription,
  dataCategory: DataCategory.PROFILE_DURATION | DataCategory.PROFILE_DURATION_UI
): boolean {
  if (subscription.onDemandMaxSpend) {
    return true;
  }

  const category: BillingMetricHistory | undefined =
    subscription.categories[dataCategory];
  if (!category) {
    return false;
  }

  if (
    (category.reserved && category.reserved > 0) ||
    (category.free && category.free > 0) ||
    (category.onDemandBudget && category.onDemandBudget > 0) ||
    (category.onDemandQuantity && category.onDemandQuantity > 0)
  ) {
    return true;
  }

  return false;
}
