import type {Scope} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';

import {
  type BillingMetricHistory,
  BillingType,
  type EventBucket,
  type Subscription,
} from 'getsentry/types';
import {isAmPlan, isDeveloperPlan} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {getBucket} from 'getsentry/views/amCheckout/utils';

export const hasPermissions = ({access}: Organization, scope: Scope) =>
  access?.includes(scope);

export const trackSubscriptionView = (
  organization: Organization,
  subscription: Subscription,
  page: string
) =>
  trackGetsentryAnalytics('subscription_page.viewed', {
    organization,
    subscription,
    page_tab: page,
  });

export function calculateCategorySpend(
  subscription: Subscription,
  category: string
): {
  onDemandSpent: number;
  onDemandUnitPrice: number;
  prepaidPrice: number;
  prepaidSpent: number;
  unitPrice: number;
} {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const categoryInfo: BillingMetricHistory = subscription.categories[category];
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const slots: EventBucket[] = subscription.planDetails.planCategories[category];
  if (!defined(categoryInfo?.reserved)) {
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
  const percentPrepaidUsed = Math.min(reservedUse / eventsByPrice, 1);
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
  prepaidTotalPrice: number;
  prepaidTotalSpent: number;
} {
  let prepaidTotalSpent = 0;
  let onDemandTotalSpent = 0;
  let prepaidTotalPrice = 0;
  for (const category of subscription.planDetails.categories) {
    const {prepaidSpent, onDemandSpent, prepaidPrice} = calculateCategorySpend(
      subscription,
      category
    );
    prepaidTotalSpent += prepaidSpent;
    onDemandTotalSpent += onDemandSpent;
    prepaidTotalPrice += prepaidPrice;
  }

  return {prepaidTotalSpent, onDemandTotalSpent, prepaidTotalPrice};
}

/**
 * Check if the plan is one that we can show spend for
 */
export function shouldSeeSpendVisibility(subscription: Subscription) {
  return (
    !subscription.isSponsored &&
    !subscription.isTrial &&
    subscription.type !== BillingType.INVOICED &&
    // Exclude mmX as the remaining mmX plans should be managed or partner plans
    isAmPlan(subscription.plan) &&
    // No spend from developer plans
    !isDeveloperPlan(subscription.planDetails)
  );
}

export function hasSpendVisibilityNotificationsFeature(organization: Organization) {
  return organization.features.includes('spend-visibility-notifications');
}
