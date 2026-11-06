import {useQuery} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {BillingConfigTier} from 'getsentry/constants';
import type {BillingConfig} from 'getsentry/types';

interface UseBillingConfigProps {
  organization: Organization;
}

export function useBillingConfig({organization}: UseBillingConfigProps) {
  return useQuery(
    apiOptions.as<BillingConfig>()('/customers/$organizationIdOrSlug/billing-config/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {tier: BillingConfigTier.UPSELL},
      staleTime: Infinity,
    })
  );
}
