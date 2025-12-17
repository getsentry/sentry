import {useSeerOnboardingCheck} from 'sentry/utils/useSeerOnboardingCheck';

export function useSeerOnboardingStep() {
  const statusQuery = useSeerOnboardingCheck({staleTime: 60_000});

  let initialStep = 1;

  if (!statusQuery.isPending && statusQuery.data) {
    const {
      hasSupportedScmIntegration,
      isCodeReviewEnabled,
      isAutofixEnabled,
      isSeerConfigured,
    } = statusQuery.data;

    if (isSeerConfigured) {
      initialStep = 5; // Next steps
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
