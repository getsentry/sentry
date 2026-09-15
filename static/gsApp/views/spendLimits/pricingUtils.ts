import {DataCategory} from 'sentry/types/core';

import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import type {Plan} from 'getsentry/types';
import {displayPriceWithCents, getBucket} from 'getsentry/views/amCheckout/utils';

export function formatPaygPricePerUnit({paygPpe}: {paygPpe: number}) {
  return displayPriceWithCents({
    cents: paygPpe,
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
}

export function getPaygPpe({
  activePlan,
  category,
  reserved,
}: {
  activePlan: Plan;
  category: DataCategory;
  reserved: number;
}) {
  const bucket = getBucket({
    buckets: activePlan.planCategories[category],
    events: reserved === RESERVED_BUDGET_QUOTA ? reserved : reserved + 1,
  });
  return bucket.onDemandPrice ?? 0;
}
