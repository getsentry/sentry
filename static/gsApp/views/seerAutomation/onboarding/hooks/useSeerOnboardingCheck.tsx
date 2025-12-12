import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface SeerOnboardingConfig {
  hasSupportedScmIntegration: boolean;
  isAutofixEnabled: boolean;
  isCodeReviewEnabled: boolean;
  isSeerConfigured: boolean;
}

function useSeerOnboardingCheck(enabled = true) {
  const organization = useOrganization();

  return useApiQuery<SeerOnboardingConfig>(
    [`/organizations/${organization.slug}/seer/onboarding-check/`],
    {
      enabled,
      staleTime: 60000, // 1 minute
    }
  );
}

export default useSeerOnboardingCheck;
