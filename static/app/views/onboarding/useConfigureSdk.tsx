import {useCallback} from 'react';
import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {useCreateProject} from 'sentry/components/onboarding/useCreateProject';
import {t} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useTeams} from 'sentry/utils/useTeams';

/**
 * A custom hook that loads the "Getting Started" documentation for a selected platform.
 * If the project for the selected platform doesn't exist, it creates a new one.
 */
export function useConfigureSdk({
  onComplete,
}: {
  onComplete: (selectedPlatform: OnboardingSelectedSDK) => void;
}) {
  const {teams, fetching: isLoadingTeams} = useTeams();
  const {projects} = useProjects();
  const organization = useOrganization();
  const onboardingContext = useOnboardingContext();
  const createProject = useCreateProject({
    onLoading: () => {
      addLoadingMessage(t('Loading SDK configuration\u2026'));
    },
    onSuccess: ({platform}) => {
      onboardingContext.setSelectedPlatform(platform);
      trackAnalytics('growth.onboarding_set_up_your_project', {
        platform: platform.key,
        organization,
      });

      clearIndicators();
      setTimeout(() => onComplete(platform));
    },
    onError: error => {
      addErrorMessage(t('Failed to load SDK configuration'));
      Sentry.captureException(error);
      clearIndicators();
    },
  });

  const firstAccessTeam = teams.find(team => team.access.includes('team:admin'));
  const firstTeamSlug = firstAccessTeam?.slug;

  const createPlatformProject = useCallback(
    (selectedPlatform?: OnboardingSelectedSDK) => {
      if (!selectedPlatform) {
        return;
      }

      const createProjectForPlatform: OnboardingSelectedSDK | undefined = projects.some(
        p => p.slug === selectedPlatform.key
      )
        ? undefined
        : selectedPlatform;

      if (!createProjectForPlatform) {
        onboardingContext.setSelectedPlatform(selectedPlatform);

        trackAnalytics('growth.onboarding_set_up_your_project', {
          platform: selectedPlatform.key,
          organization,
        });

        onComplete(selectedPlatform);
        return;
      }

      createProject.mutate({
        name: createProjectForPlatform.key,
        platform: createProjectForPlatform,
        firstTeamSlug,
      });
    },
    [createProject, firstTeamSlug, onboardingContext, onComplete, projects, organization]
  );

  const configureSdk = useCallback(
    async (selectedPlatform?: OnboardingSelectedSDK) => {
      if (!selectedPlatform) {
        return;
      }

      if (
        selectedPlatform.type !== 'language' ||
        !Object.values(SupportedLanguages).includes(
          selectedPlatform.language as SupportedLanguages
        )
      ) {
        createPlatformProject(selectedPlatform);
        return;
      }

      const {FrameworkSuggestionModal, modalCss} = await import(
        'sentry/components/onboarding/frameworkSuggestionModal'
      );

      openModal(
        deps => (
          <FrameworkSuggestionModal
            {...deps}
            organization={organization}
            selectedPlatform={selectedPlatform}
            onConfigure={selectedFramework => {
              createPlatformProject(selectedFramework);
            }}
            onSkip={() => createPlatformProject(selectedPlatform)}
            configuringSDK={createProject.isPending}
            newOrg
          />
        ),
        {
          modalCss,
          onClose: () => {
            trackAnalytics('onboarding.select_framework_modal_close_button_clicked', {
              platform: selectedPlatform.key,
              organization,
            });
            onboardingContext.setSelectedPlatform(undefined);
          },
        }
      );
    },
    [createPlatformProject, onboardingContext, organization, createProject.isPending]
  );

  return {configureSdk, isLoadingData: isLoadingTeams};
}
