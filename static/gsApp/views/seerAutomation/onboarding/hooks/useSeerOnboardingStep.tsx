import {useSeerOnboardingCheck} from 'sentry/utils/useSeerOnboardingCheck';

import {Steps} from 'getsentry/views/seerAutomation/onboarding/types';

export function useSeerOnboardingStep() {
  const statusQuery = useSeerOnboardingCheck({staleTime: 60_000});

  let initialStep = Steps.CONNECT_GITHUB;

  if (!statusQuery.isPending && statusQuery.data) {
    const {
      hasSupportedScmIntegration,
      isCodeReviewEnabled,
      isAutofixEnabled,
      isSeerConfigured,
    } = statusQuery.data;

    if (isSeerConfigured) {
      initialStep = Steps.WRAP_UP; // Next steps
    } else if (!hasSupportedScmIntegration) {
      initialStep = Steps.CONNECT_GITHUB; // Connect GitHub
    } else if (!isCodeReviewEnabled) {
      initialStep = Steps.SETUP_CODE_REVIEW; // Setup Code Review
    } else if (!isAutofixEnabled) {
      // This shouldn't happen because `isSeerConfigured` = `isCodeReviewEnabled` OR `isAutofixEnabled`
      initialStep = Steps.SETUP_ROOT_CAUSE_ANALYSIS; // Setup Root Cause Analysis
    }
  }

  return {
    isPending: statusQuery.isPending,
    initialStep,
  };
}
