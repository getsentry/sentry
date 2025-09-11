import {DataCategory} from 'sentry/types/core';

import type {BillingMetricHistory, Subscription} from 'getsentry/types';

export enum BudgetUsage {
  EXCEEDED = 'exceeded',
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
  UNKNOWN = 'unknown',
}

export function checkBudgetUsageFor(
  subscription: Subscription,
  dataCategory: DataCategory.PROFILE_DURATION | DataCategory.PROFILE_DURATION_UI
): BudgetUsage {
  const category: BillingMetricHistory | undefined =
    subscription.categories[dataCategory];
  if (!category) {
    return BudgetUsage.UNKNOWN;
  }

  if (
    (category.reserved && category.reserved > 0) ||
    (category.free && category.free > 0) ||
    (category.onDemandBudget && category.onDemandBudget > 0) ||
    (category.onDemandQuantity && category.onDemandQuantity > 0)
  ) {
    if (category.usageExceeded) {
      return BudgetUsage.EXCEEDED;
    }
    return BudgetUsage.AVAILABLE;
  }

  if (subscription.onDemandMaxSpend) {
    if (category.usageExceeded) {
      return BudgetUsage.EXCEEDED;
    }
    return BudgetUsage.AVAILABLE;
  }

  return BudgetUsage.UNAVAILABLE;
}
