import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface SeerOnboardingCheckResponse {
  hasSupportedScmIntegration: boolean;
  isAutofixEnabled: boolean;
  isCodeReviewEnabled: boolean;
  isSeerConfigured: boolean;
}

export function useSeerOnboardingCheck({
  enabled = true,
  staleTime = 0,
}: {
  enabled?: boolean;
  staleTime?: number;
} = {}) {
  const organization = useOrganization();
  return useQuery({
    ...apiOptions.as<SeerOnboardingCheckResponse>()(
      '/organizations/$organizationIdOrSlug/seer/onboarding-check/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
        },
        staleTime,
      }
    ),
    enabled,
  });
}
