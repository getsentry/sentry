import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface SeerOnboardingCheckResponse {
  hasSupportedScmIntegration: boolean;
  isAutofixEnabled: boolean;
  isCodeReviewEnabled: boolean;
  isSeerConfigured: boolean;
}

export function useSeerOnboardingCheck() {
  const organization = useOrganization();

  return useApiQuery<SeerOnboardingCheckResponse>(
    [`/organizations/${organization.slug}/seer/onboarding-check/`],
    {
      staleTime: 0,
    }
  );
}
