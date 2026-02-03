import type {Organization} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';

import type {PromotionData} from 'getsentry/types';

export function createPromotionCheckQueryKey(orgSlug: string): ApiQueryKey {
  return [
    getApiUrl(`/organizations/$organizationIdOrSlug/promotions/trigger-check/`, {
      path: {organizationIdOrSlug: orgSlug},
    }),
    {method: 'POST'},
  ];
}

/**
 * Initiates a promotion trigger check for the organization
 */
export default function usePromotionTriggerCheck(organization: Organization) {
  return useApiQuery<PromotionData>(createPromotionCheckQueryKey(organization.slug), {
    staleTime: 10000,
    retry: 0,
  });
}
