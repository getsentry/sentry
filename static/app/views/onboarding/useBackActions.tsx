import {useCallback, useContext} from 'react';
import {useBlocker} from 'react-router-dom';
import type {useAnimation} from 'framer-motion';

import {removeProject} from 'sentry/actionCreators/projects';
import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {onboardingSteps} from 'sentry/views/onboarding/onboarding';
import {hasDocsOnPlatformClickEnabled} from 'sentry/views/onboarding/platformSelection';
import type {StepDescriptor} from 'sentry/views/onboarding/types';

/**
 * Custom hook that performs a couple of actions when navigating back in the onboarding flow,
 * either by clicking the native browser back button or a custom back button.
 */
export function useBackActions({
  stepIndex,
  recentCreatedProject,
  isRecentCreatedProjectActive,
  goToStep,
  cornerVariantControl,
}: {
  cornerVariantControl: ReturnType<typeof useAnimation>;
  goToStep: (step: StepDescriptor) => void;
  stepIndex: number;
  isRecentCreatedProjectActive?: boolean;
  recentCreatedProject?: Project;
}) {
  const api = useApi();
  const organization = useOrganization();
  const onboardingContext = useContext(OnboardingContext);
  const currentStep = onboardingSteps[stepIndex];

  const docsOnPlatformClickEnabled = hasDocsOnPlatformClickEnabled(organization);

  const deleteRecentCreatedProject = useCallback(async () => {
    if (!recentCreatedProject) {
      return;
    }
    const currentProjects = {...onboardingContext.data.projects};
    const newProjects = Object.keys(currentProjects).reduce((acc, key) => {
      if (currentProjects[key]!.slug !== onboardingContext.data.selectedSDK?.key) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        acc[key] = currentProjects[key];
      }
      return acc;
    }, {});

    try {
      if (docsOnPlatformClickEnabled) {
        onboardingContext.setData({
          ...onboardingContext.data,
          projects: newProjects,
          selectedSDK: undefined,
        });
      } else {
        onboardingContext.setData({
          ...onboardingContext.data,
          projects: newProjects,
        });
      }
      await removeProject({
        api,
        orgSlug: organization.slug,
        projectSlug: recentCreatedProject.slug,
        origin: 'onboarding',
      });

      trackAnalytics('onboarding.data_removed', {
        organization,
        date_created: recentCreatedProject.dateCreated,
        platform: recentCreatedProject.slug,
        project_id: recentCreatedProject.id,
      });
    } catch (error) {
      onboardingContext.setData({
        ...onboardingContext.data,
        projects: currentProjects,
      });
      if (docsOnPlatformClickEnabled) {
        onboardingContext.setData({
          ...onboardingContext.data,
          projects: currentProjects,
          selectedSDK: undefined,
        });
      } else {
        onboardingContext.setData({
          ...onboardingContext.data,
          projects: currentProjects,
        });
      }
      handleXhrErrorResponse('Unable to delete project in onboarding', error);
      // we don't give the user any feedback regarding this error as this shall be silent
    }
  }, [
    api,
    organization,
    onboardingContext,
    recentCreatedProject,
    docsOnPlatformClickEnabled,
  ]);

  const backStepActions = useCallback(
    ({
      prevStep,
      browserBackButton,
    }: {
      browserBackButton: boolean;
      prevStep?: StepDescriptor;
    }) => {
      if (!prevStep || !currentStep) {
        return;
      }

      if (!browserBackButton) {
        // this check happens in the `goToStep` function as well
        if (currentStep.cornerVariant !== prevStep.cornerVariant) {
          cornerVariantControl.start('none');
        }
      }

      trackAnalytics('onboarding.back_button_clicked', {
        organization,
        from: currentStep.id,
        to: prevStep.id,
        browserBackButton,
      });

      // from selected platform to welcome
      if (currentStep.id === 'select-platform') {
        onboardingContext.setData({...onboardingContext.data, selectedSDK: undefined});

        if (!browserBackButton) {
          goToStep(prevStep);
        }
        return;
      }

      // from setup docs to selected platform
      if (
        currentStep.id === 'setup-docs' &&
        defined(isRecentCreatedProjectActive) &&
        !isRecentCreatedProjectActive &&
        recentCreatedProject
      ) {
        trackAnalytics('onboarding.data_removal_modal_confirm_button_clicked', {
          organization,
          platform: recentCreatedProject.slug,
          project_id: recentCreatedProject.id,
        });
        deleteRecentCreatedProject();
      }

      if (!browserBackButton) {
        goToStep(prevStep);
      }
    },
    [
      goToStep,
      organization,
      cornerVariantControl,
      onboardingContext,
      isRecentCreatedProjectActive,
      recentCreatedProject,
      currentStep,
      deleteRecentCreatedProject,
    ]
  );

  // We are not blocking the navigation here; this is only used to call back step actions before changing paths.
  // The 'popstate' event listener was attempted but didn't work, as it unmounts every time the path changes, which is the very behavior that needs to be tracked.
  // Using `useRef` to save the previous path also didn't work due to excessive re-renders.
  // 'beforeunload' was ruled out because it triggers during page refreshes or when tabs are closed, which isn't ideal.
  // Ultimately, `useBlocker` proved to be the best solution.
  useBlocker(({historyAction, nextLocation}) => {
    if (historyAction === 'POP') {
      const prevStepIndex = onboardingSteps.findIndex(
        step => nextLocation.pathname === `/onboarding/${step.id}/`
      );
      if (prevStepIndex < stepIndex) {
        backStepActions({
          prevStep: onboardingSteps[prevStepIndex],
          browserBackButton: true,
        });
      }
    }
    return false;
  });

  const handleGoBack = useCallback(
    (goToStepIndex?: number) => {
      backStepActions({
        prevStep: onboardingSteps[defined(goToStepIndex) ? goToStepIndex : stepIndex - 1],
        browserBackButton: false,
      });
    },
    [stepIndex, backStepActions]
  );

  return {handleGoBack};
}
