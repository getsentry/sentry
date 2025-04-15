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
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
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
  const api = useApi();
  const {teams, fetching: isLoadingTeams} = useTeams();
  const {projects} = useProjects();
  const organization = useOrganization();
  const onboardingContext = useOnboardingContext();

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

        // A default team should always be created for a new organization.
        // If teams are loaded but no first team is found, fallback to the experimental project.
        if (!firstTeamSlug) {
          Sentry.captureException('No team slug found for new org during onboarding');
        }
        const url = firstTeamSlug
          ? `/teams/${organization.slug}/${firstTeamSlug}/projects/`
          : `/organizations/${organization.slug}/experimental/projects/`;

        const response = (await api.requestPromise(url, {
          method: 'POST',
          data: {
            platform: createProjectForPlatform.key,
            name: createProjectForPlatform.key,
            default_rules: true,
            origin: 'ui',
          },
        })) as Project;

        ProjectsStore.onCreateSuccess(response, organization.slug);

        onboardingContext.setSelectedPlatform(createProjectForPlatform);

        trackAnalytics('growth.onboarding_set_up_your_project', {
          platform: selectedPlatform.key,
          organization,
        });

        clearIndicators();
        setTimeout(() => onComplete(createProjectForPlatform));
      } catch (err) {
        addErrorMessage(t('Failed to load SDK configuration'));
        Sentry.captureException(err);
      }
    },
    [onboardingContext, api, organization, firstTeamSlug, projects, onComplete]
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
    [createPlatformProject, onboardingContext, organization]
  );

  return {configureSdk, isLoadingData: isLoadingTeams};
}
