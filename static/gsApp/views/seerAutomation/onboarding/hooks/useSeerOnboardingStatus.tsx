import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import useOrganization from 'sentry/utils/useOrganization';

interface OnboardingStatus {
  hasSupportedScmIntegration: boolean;
  isAutofixEnabled: boolean;
  isCodeReviewEnabled: boolean;
  isSeerConfigured: boolean;
}

function useSeerOnboardingStatus({staleTime = 0}: {staleTime?: number}) {
  const organization = useOrganization();
  return useQuery({
    ...apiOptions.as<OnboardingStatus>()(
      '/organizations/$organizationIdOrSlug/seer/onboarding-check/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
        },
        staleTime,
      }
    ),
  });
}

export function useSeerOnboardingStep() {
  const statusQuery = useSeerOnboardingStatus({staleTime: 60_000});

  let initialStep = 1;

  if (!statusQuery.isPending && statusQuery.data) {
    const {
      hasSupportedScmIntegration,
      isCodeReviewEnabled,
      isAutofixEnabled,
      isSeerConfigured,
    } = statusQuery.data;

    if (isSeerConfigured) {
      initialStep = 4; // Next steps
    } else if (!hasSupportedScmIntegration) {
      initialStep = 1; // Connect GitHub
    } else if (!isCodeReviewEnabled) {
      initialStep = 2; // Setup Code Review
    } else if (!isAutofixEnabled) {
      initialStep = 3; // Setup Root Cause Analysis
    }
  }

  return {
    isPending: statusQuery.isPending,
    initialStep,
  };
}
