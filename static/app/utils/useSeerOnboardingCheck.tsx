import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey, type ApiQueryKey} from 'sentry/utils/api/queryKey';
import {queryOptions} from 'sentry/utils/queryClient';

interface SeerOnboardingCheckResponse {
  hasSupportedScmIntegration: boolean;
  isAutofixEnabled: boolean;
  isCodeReviewEnabled: boolean;
  isSeerConfigured: boolean;
  needsConfigReminder: boolean;
}

export function seerOnboardingCheckOptions(organization: Organization) {
  // Also: what's the difference between TQueryFnData and TData?
  type TQueryData = ApiResponse<SeerOnboardingCheckResponse>; // returned from the API
  type TData = SeerOnboardingCheckResponse; // returned from the select function

  // TODO: this typing is annoying to do all the time. But it's needed so we can
  // have `ApiQueryKey` in there.
  // I think we can override the type in the queryOptions function, to include
  // it automatically, and/or override the internals of useQuery.
  return queryOptions<TQueryData, Error, TData, ApiQueryKey>({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/seer/onboarding-check/', {
      path: {
        organizationIdOrSlug: organization.slug,
      },
    }),
    queryFn: apiFetch,
    select: data => data.json,
    staleTime: 0,
  });
}
