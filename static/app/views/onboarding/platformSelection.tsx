import {useCallback, useContext, useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {motion} from 'framer-motion';
import omit from 'lodash/omit';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {createProject} from 'sentry/actionCreators/projects';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import PlatformPicker from 'sentry/components/platformPicker';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {OnboardingProjectStatus} from 'sentry/types/onboarding';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useTeams} from 'sentry/utils/useTeams';
import GenericFooter from 'sentry/views/onboarding/components/genericFooter';
import StepHeading from 'sentry/views/onboarding/components/stepHeading';

import type {StepProps} from './types';

export function PlatformSelection({onComplete, ...props}: StepProps) {
  const organization = useOrganization();
  const onboardingContext = useContext(OnboardingContext);
  const api = useApi();
  const {projects} = useProjects();
  const {teams} = useTeams();

  const selectedPlatform = onboardingContext.data.selectedSDK
    ? platforms.find(platform => platform.id === onboardingContext.data.selectedSDK?.key)
      ? onboardingContext.data.selectedSDK
      : undefined
    : undefined;

  const createPlatformProject = useCallback(
    async (selectedFramework?: OnboardingSelectedSDK) => {
      if (!selectedPlatform) {
        return;
      }

      let createProjectForPlatform: OnboardingSelectedSDK | undefined = undefined;

      if (selectedFramework) {
        createProjectForPlatform = projects.find(p => p.slug === selectedFramework.key)
          ? undefined
          : selectedFramework;
      } else {
        createProjectForPlatform = projects.find(
          p => p.slug === onboardingContext.data.selectedSDK?.key
        )
          ? undefined
          : onboardingContext.data.selectedSDK;
      }

      if (!createProjectForPlatform) {
        const platform = selectedFramework ? selectedFramework : selectedPlatform;

        trackAnalytics('growth.onboarding_set_up_your_project', {
          platform: selectedPlatform.key,
          organization,
        });

        onComplete(platform);
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
    [onboardingContext, selectedPlatform, api, organization, teams, projects, onComplete]
  );

  const configureSDK = useCallback(
    async (platform: OnboardingSelectedSDK) => {
      if (
        platform.type !== 'language' ||
        !Object.values(SupportedLanguages).includes(
          platform.language as SupportedLanguages
        )
      ) {
        createPlatformProject();
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
            selectedPlatform={platform}
            onConfigure={selectedFramework => {
              onboardingContext.setData({
                ...onboardingContext.data,
                selectedSDK: selectedFramework,
              });
              createPlatformProject(selectedFramework);
            }}
            onSkip={createPlatformProject}
            newOrg
          />
        ),
        {
          modalCss,
          onClose: () => {
            trackAnalytics('onboarding.select_framework_modal_close_button_clicked', {
              platform: platform.key,
              organization,
            });
          },
        }
      );
    },
    [createPlatformProject, onboardingContext, organization]
  );

  useEffect(() => {
    if (!selectedPlatform) {
      return;
    }

    configureSDK(selectedPlatform);
  }, [selectedPlatform, configureSDK]);

  return (
    <Wrapper>
      <StepHeading step={props.stepIndex}>
        {t('Select the platform you want to monitor')}
      </StepHeading>
      <motion.div
        transition={testableTransition()}
        variants={{
          initial: {y: 30, opacity: 0},
          animate: {y: 0, opacity: 1},
          exit: {opacity: 0},
        }}
      >
        <p>
          {t(
            'Set up a separate project for each part of your application (for example, your API server and frontend client), to quickly pinpoint which part of your application errors are coming from.'
          )}
        </p>
        <PlatformPicker
          noAutoFilter
          source="targeted-onboarding"
          platform={onboardingContext.data.selectedSDK?.key}
          defaultCategory={onboardingContext.data.selectedSDK?.category}
          setPlatform={platform => {
            onboardingContext.setData({
              ...onboardingContext.data,
              selectedSDK: platform
                ? {...omit(platform, 'id'), key: platform.id}
                : undefined,
            });
          }}
          organization={organization}
        />
      </motion.div>
      <GenericFooter>{props.genSkipOnboardingLink()}</GenericFooter>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  max-width: 850px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
`;
