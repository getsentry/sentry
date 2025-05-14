import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

import {UPSELL_TIER} from 'getsentry/constants';
import {type BillingConfig, PlanTier, type Subscription} from 'getsentry/types';

interface UseBillingConfigProps {
  organization: Organization;
  subscription: Subscription;
}

export function useBillingConfig({organization, subscription}: UseBillingConfigProps) {
  const upsellTier =
    subscription.planTier === PlanTier.AM3 || subscription.trialTier === PlanTier.AM3
      ? PlanTier.AM3
      : UPSELL_TIER;
  return useApiQuery<BillingConfig>(
    [`/customers/${organization.slug}/billing-config/`, {query: {tier: upsellTier}}],
    {staleTime: Infinity}
  );
}
