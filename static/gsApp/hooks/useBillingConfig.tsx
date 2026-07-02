import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';

import {BillingConfigTier} from 'getsentry/constants';
import type {BillingConfig} from 'getsentry/types';

interface UseBillingConfigProps {
  organization: Organization;
}

export function useBillingConfig({organization}: UseBillingConfigProps) {
  return useApiQuery<BillingConfig>(
    [
      getApiUrl('/customers/$organizationIdOrSlug/billing-config/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {tier: BillingConfigTier.UPSELL}},
    ],
    {staleTime: Infinity}
  );
}
