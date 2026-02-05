import {useCallback} from 'react';
import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {openConsoleModal, openModal} from 'sentry/actionCreators/modal';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {useCreateProject} from 'sentry/components/onboarding/useCreateProject';
import {t} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDisabledGamingPlatform} from 'sentry/utils/platform';
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
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const organization = useOrganization();
  const onboardingContext = useOnboardingContext();
  const createProject = useCreateProject();

  const firstAccessTeam = teams.find(team => team.access.includes('team:admin'));
  const firstTeamSlug = firstAccessTeam?.slug;

  const createPlatformProject = useCallback(
    async (selectedPlatform?: OnboardingSelectedSDK) => {
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

      try {
        addLoadingMessage(t('Loading SDK configuration\u2026'));
        await createProject.mutateAsync({
          name: createProjectForPlatform.key,
          platform: createProjectForPlatform,
          firstTeamSlug,
        });
        onboardingContext.setSelectedPlatform(createProjectForPlatform);
        trackAnalytics('growth.onboarding_set_up_your_project', {
          platform: createProjectForPlatform.key,
          organization,
        });
        setTimeout(() => onComplete(createProjectForPlatform));
      } catch (error) {
        addErrorMessage(t('Failed to load SDK configuration'));
        Sentry.captureException(error);
      } finally {
        clearIndicators();
      }
    },
    [createProject, firstTeamSlug, onboardingContext, onComplete, projects, organization]
  );

  const configureSdk = useCallback(
    async (selectedPlatform?: OnboardingSelectedSDK) => {
      if (!selectedPlatform) {
        return;
      }

      if (createProject.isPending) {
        // prevent multiple submissions at the same time
        return;
      }

      if (
        isDisabledGamingPlatform({
          platform: {
            ...selectedPlatform,
            id: selectedPlatform.key,
          },
          enabledConsolePlatforms: organization.enabledConsolePlatforms,
        })
      ) {
        openConsoleModal({
          organization,
          selectedPlatform,
          origin: 'onboarding',
        });
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

      const {FrameworkSuggestionModal, modalCss} =
        await import('sentry/components/onboarding/frameworkSuggestionModal');

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
    [createPlatformProject, onboardingContext, organization, createProject]
  );

  return {
    configureSdk,
    isLoadingData: isLoadingTeams || !projectsLoaded || createProject.isPending,
  };
}
