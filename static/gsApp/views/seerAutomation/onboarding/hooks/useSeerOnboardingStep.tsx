import {useSeerOnboardingCheck} from 'sentry/utils/useSeerOnboardingCheck';

import {Steps} from 'getsentry/views/seerAutomation/onboarding/types';

export function useSeerOnboardingStep() {
  const {isPending, data} = useSeerOnboardingCheck({staleTime: 60_000});

  let initialStep = Steps.CONNECT_GITHUB;

  if (!isPending && data) {
    const {
      hasSupportedScmIntegration,
      isCodeReviewEnabled,
      isAutofixEnabled,
      needsConfigReminder,
    } = data;

    // Once the org has setup code-review then we'll stop bugging them.
    const shouldShowConfigReminder = needsConfigReminder && !isCodeReviewEnabled;

    if (hasSupportedScmIntegration) {
      if (isAutofixEnabled && isCodeReviewEnabled) {
        initialStep = Steps.WRAP_UP; // Next steps
      } else if (!isAutofixEnabled || shouldShowConfigReminder) {
        initialStep = Steps.SETUP_ROOT_CAUSE_ANALYSIS; // Setup Root Cause Analysis
      } else if (!isCodeReviewEnabled) {
        initialStep = Steps.SETUP_CODE_REVIEW; // Setup Code Review
      }
    } else {
      initialStep = Steps.CONNECT_GITHUB; // Connect GitHub
    }
  }

  return {
    isPending,
    initialStep,
  };
}
