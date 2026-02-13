import type {Organization} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';

import {UPSELL_TIER} from 'getsentry/constants';
import {PlanTier, type BillingConfig, type Subscription} from 'getsentry/types';

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
    [
      getApiUrl(`/customers/$organizationIdOrSlug/billing-config/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {tier: upsellTier}},
    ],
    {staleTime: Infinity}
  );
}
