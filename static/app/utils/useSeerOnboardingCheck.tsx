import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface SeerOnboardingCheckResponse {
  hasSupportedScmIntegration: boolean;
  isAutofixEnabled: boolean;
  isCodeReviewEnabled: boolean;
  isSeerConfigured: boolean;
}

export function useSeerOnboardingCheck(enabled = true) {
  const organization = useOrganization();

  return useApiQuery<SeerOnboardingCheckResponse>(
    [`/organizations/${organization.slug}/seer/onboarding-check/`],
    {
      enabled,
      staleTime: 60000, // 1 minute
    }
  );
}
