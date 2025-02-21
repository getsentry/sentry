import type {Organization} from 'sentry/types/organization';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';

import type {PromotionData} from 'getsentry/types';

export function createPromotionCheckQueryKey(orgSlug: string): ApiQueryKey {
  return [`/organizations/${orgSlug}/promotions/trigger-check/`, {method: 'POST'}];
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
