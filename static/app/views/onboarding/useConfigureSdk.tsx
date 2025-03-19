import {useCallback, useContext} from 'react';
import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {createProject} from 'sentry/actionCreators/projects';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {
  OnboardingProjectStatus,
  type OnboardingSelectedSDK,
} from 'sentry/types/onboarding';
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
  const {teams} = useTeams();
  const {projects} = useProjects();
  const organization = useOrganization();
  const onboardingContext = useContext(OnboardingContext);

  const createPlatformProject = useCallback(
    async (selectedPlatform?: OnboardingSelectedSDK) => {
      if (!selectedPlatform) {
        return;
      }

      const createProjectForPlatform: OnboardingSelectedSDK | undefined = projects.find(
        p => p.slug === selectedPlatform.key
      )
        ? undefined
        : selectedPlatform;

      if (!createProjectForPlatform) {
        onboardingContext.setData({
          ...onboardingContext.data,
          selectedSDK: selectedPlatform,
        });

        trackAnalytics('growth.onboarding_set_up_your_project', {
          platform: selectedPlatform.key,
          organization,
        });

        onComplete(selectedPlatform);
        return;
      }

      try {
        addLoadingMessage(t('Loading SDK configuration\u2026'));

        const response = (await createProject({
          api,
          orgSlug: organization.slug,
          team: teams[0]!.slug,
          platform: createProjectForPlatform.key,
          name: createProjectForPlatform.key,
          options: {
            defaultRules: true,
          },
        })) as Project;

        ProjectsStore.onCreateSuccess(response, organization.slug);

        // Measure to filter out projects that might have been created during the onboarding and not deleted from the session due to an error
        // Note: in the onboarding flow the projects are created based on the platform slug
        const newProjects = Object.keys(onboardingContext.data.projects).reduce(
          (acc, key) => {
            if (onboardingContext.data.projects[key]!.slug !== response.slug) {
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              acc[key] = onboardingContext.data.projects[key];
            }
            return acc;
          },
          {}
        );

        onboardingContext.setData({
          selectedSDK: createProjectForPlatform,
          projects: {
            ...newProjects,
            [response.id]: {
              slug: response.slug,
              status: OnboardingProjectStatus.WAITING,
            },
          },
        });

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
    [onboardingContext, api, organization, teams, projects, onComplete]
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
            onboardingContext.setData({
              ...onboardingContext.data,
              selectedSDK: undefined,
            });
          },
        }
      );
    },
    [createPlatformProject, onboardingContext, organization]
  );

  return {configureSdk};
}
