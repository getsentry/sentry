import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/queryKey';
import {queryOptions} from 'sentry/utils/queryClient';

interface SeerOnboardingCheckResponse {
  hasSupportedScmIntegration: boolean;
  isAutofixEnabled: boolean;
  isCodeReviewEnabled: boolean;
  isSeerConfigured: boolean;
  needsConfigReminder: boolean;
}

export function seerOnboardingCheckOptions(organization: Organization) {
  // What's the difference between TQueryFnData and TData?
  type TQueryData = ApiResponse<SeerOnboardingCheckResponse>; // returned from the API
  type TData = SeerOnboardingCheckResponse; // returned from the select function

  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/seer/onboarding-check/', {
      path: {
        organizationIdOrSlug: organization.slug,
      },
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0,
  });
}
