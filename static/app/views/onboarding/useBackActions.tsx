import {useCallback} from 'react';
import {useBlocker} from 'react-router';

import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {StepDescriptor} from './types';

/**
 * Records Back navigation in the onboarding flow, from either the browser
 * button or the in-app Back button.
 *
 * Back never deletes the project created earlier in the session: the user may
 * already have copied its DSN, and browser Forward must still land on a live
 * project. Continue then edits that project to match the user's new choices
 * (see useScmProjectCreation), so its DSN never changes.
 */
export function useBackActions({
  stepIndex,
  onboardingSteps,
  goToStep,
}: {
  goToStep: (step: StepDescriptor) => void;
  onboardingSteps: StepDescriptor[];
  stepIndex: number;
}) {
  const organization = useOrganization();
  const currentStep = onboardingSteps[stepIndex];

  const trackBack = useCallback(
    (prevStep: StepDescriptor, browserBackButton: boolean) => {
      if (!currentStep) {
        return;
      }
      trackAnalytics('onboarding.scm_back_button_clicked', {
        organization,
        from: currentStep.id,
        to: prevStep.id,
        browserBackButton,
      });
    },
    [currentStep, organization]
  );

  // Never blocks; this is the only hook that sees a browser Back before the
  // step unmounts. A popstate listener unmounts with every path change, and
  // beforeunload also fires on refresh and tab close.
  useBlocker(({historyAction, nextLocation}) => {
    if (historyAction === 'POP') {
      const prevStepIndex = onboardingSteps.findIndex(
        step =>
          normalizeUrl(nextLocation.pathname, {forceCustomerDomain: true}) ===
          `/onboarding/${step.id}/`
      );
      const prevStep = onboardingSteps[prevStepIndex];
      if (prevStep && prevStepIndex < stepIndex) {
        trackBack(prevStep, true);
      }
    }
    return false;
  });

  const handleGoBack = useCallback(
    (goToStepIndex?: number) => {
      const prevStep =
        onboardingSteps[defined(goToStepIndex) ? goToStepIndex : stepIndex - 1];
      if (!prevStep) {
        return;
      }
      trackBack(prevStep, false);
      goToStep(prevStep);
    },
    [stepIndex, onboardingSteps, trackBack, goToStep]
  );

  return {handleGoBack};
}
