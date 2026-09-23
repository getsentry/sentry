import {DataCategory} from 'sentry/types/core';

import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import type {Plan} from 'getsentry/types';
import {displayPriceWithCents, getBucket} from 'getsentry/views/amCheckout/utils';

export function formatPaygPricePerUnit({
  payAsYouGoPricePerUnit,
}: {
  payAsYouGoPricePerUnit: number;
}) {
  return displayPriceWithCents({
    cents: payAsYouGoPricePerUnit,
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
}

export function getPaygPricePerUnit({
  activePlan,
  category,
  reserved,
}: {
  activePlan: Plan;
  category: DataCategory;
  reserved: number;
}) {
  const pricingBucket = getBucket({
    buckets: activePlan.planCategories[category],
    events: reserved === RESERVED_BUDGET_QUOTA ? reserved : reserved + 1,
  });
  return pricingBucket.onDemandPrice ?? 0;
}
