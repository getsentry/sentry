import type {DataCategory, Scope} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';

import {
  type BillingMetricHistory,
  type EventBucket,
  type Subscription,
} from 'getsentry/types';
import {isPartOfReservedBudget} from 'getsentry/utils/dataCategory';
import {getBucket} from 'getsentry/views/amCheckout/utils';

export const hasPermissions = ({access}: Organization, scope: Scope) =>
  access?.includes(scope);

export function calculateCategorySpend(
  subscription: Subscription,
  category: DataCategory
): {
  onDemandSpent: number;
  onDemandUnitPrice: number;
  prepaidPrice: number;
  prepaidSpent: number;
  unitPrice: number;
} {
  const categoryInfo: BillingMetricHistory | undefined =
    subscription.categories[category];
  const slots: EventBucket[] | undefined =
    subscription.planDetails.planCategories[category];
  if (!defined(categoryInfo?.reserved) || !slots) {
    return {
      prepaidSpent: 0,
      onDemandSpent: 0,
      unitPrice: 0,
      onDemandUnitPrice: 0,
      prepaidPrice: 0,
    };
  }

  const priceBucket = getBucket({events: categoryInfo.reserved, buckets: slots});
  const eventsByPrice = getBucket({
    price: priceBucket.price,
    buckets: slots,
  }).events;

  const unitPrice = priceBucket.unitPrice ?? 0;
  // Subtract gifted usage from total usage
  const usage = categoryInfo.usage - categoryInfo.free;
  const reservedUse = Math.min(usage, eventsByPrice);
  const isMonthly = subscription.planDetails.billingInterval === 'monthly';
  // Put prepaid prices into monthly terms
  const prepaidPrice = priceBucket.price / (isMonthly ? 1 : 12);
  const percentPrepaidUsed = Math.min(
    eventsByPrice === 0 ? 0 : reservedUse / eventsByPrice,
    1
  );
  const prepaidSpent = percentPrepaidUsed * prepaidPrice;
  const onDemandSpent = categoryInfo.onDemandSpendUsed ?? 0;

  return {
    prepaidSpent,
    prepaidPrice,
    onDemandSpent,
    unitPrice,
    onDemandUnitPrice: priceBucket.onDemandPrice ?? 0,
  };
}

export function calculateTotalSpend(subscription: Subscription): {
  onDemandTotalSpent: number;
  prepaidReservedBudgetPrice: number;
  prepaidTotalPrice: number;
  prepaidTotalSpent: number;
} {
  let prepaidTotalSpent = 0;
  let prepaidReservedBudgetPrice = 0;
  let onDemandTotalSpent = 0;
  let prepaidTotalPrice = 0; // Total price of the subscription (includes upgraded reserved volumes and reserved budgets)
  for (const category of subscription.planDetails.categories) {
    const {prepaidSpent, onDemandSpent, prepaidPrice} = calculateCategorySpend(
      subscription,
      category
    );
    prepaidTotalSpent += prepaidSpent;
    onDemandTotalSpent += onDemandSpent;
    prepaidTotalPrice += prepaidPrice;
    if (isPartOfReservedBudget(category, subscription.reservedBudgets ?? [])) {
      prepaidReservedBudgetPrice += prepaidPrice;
    }
  }

  return {
    prepaidTotalSpent,
    prepaidReservedBudgetPrice,
    onDemandTotalSpent,
    prepaidTotalPrice,
  };
}

export function hasSpendVisibilityNotificationsFeature(organization: Organization) {
  return organization.features.includes('spend-visibility-notifications');
}
