import {Fragment, useCallback, useContext} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {createProject} from 'sentry/actionCreators/projects';
import {Button} from 'sentry/components/button';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import {
  OnboardingProjectStatus,
  OnboardingSelectedSDK,
  Organization,
  Project,
} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useProjects from 'sentry/utils/useProjects';
import {useTeams} from 'sentry/utils/useTeams';

import GenericFooter from './genericFooter';

type Props = {
  clearPlatform: () => void;
  genSkipOnboardingLink: () => React.ReactNode;
  onComplete: (selectedPlatform: OnboardingSelectedSDK) => void;
  organization: Organization;
  selectedPlatform?: OnboardingSelectedSDK;
};

export function CreateProjectsFooter({
  organization,
  selectedPlatform,
  onComplete,
  genSkipOnboardingLink,
  clearPlatform,
}: Props) {
  const frameworkSelectionEnabled = !!organization?.features.includes(
    'onboarding-sdk-selection'
  );

  const api = useApi();
  const {teams} = useTeams();
  const onboardingContext = useContext(OnboardingContext);
  const {projects} = useProjects();

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
          team: teams[0].slug,
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
            if (onboardingContext.data.projects[key].slug !== response.slug) {
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
        setTimeout(() => onComplete(createProjectForPlatform!));
      } catch (err) {
        addErrorMessage(t('Failed to load SDK configuration'));
        Sentry.captureException(err);
      }
    },
    [onboardingContext, selectedPlatform, api, organization, teams, projects, onComplete]
  );

  const handleProjectCreation = useCallback(async () => {
    if (!selectedPlatform) {
      return;
    }

    if (
      selectedPlatform.type !== 'language' ||
      !Object.values(SupportedLanguages).includes(
        selectedPlatform.language as SupportedLanguages
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
          selectedPlatform={selectedPlatform}
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
            platform: selectedPlatform.key,
            organization,
          });
        },
      }
    );
  }, [selectedPlatform, createPlatformProject, onboardingContext, organization]);

  return (
    <GenericFooter>
      {genSkipOnboardingLink()}
      <SelectionWrapper>
        {selectedPlatform ? (
          <Fragment>
            <div>
              <SelectedPlatformIcon
                platform={selectedPlatform.key ?? 'other'}
                size={23}
              />
            </div>
            <PlatformsSelected>
              {t('platform selected')}
              <ClearButton priority="link" onClick={clearPlatform} size="zero">
                {t('Clear')}
              </ClearButton>
            </PlatformsSelected>
          </Fragment>
        ) : null}
      </SelectionWrapper>
      <ButtonWrapper>
        <Button
          priority="primary"
          onClick={() =>
            frameworkSelectionEnabled ? handleProjectCreation() : createPlatformProject()
          }
          disabled={!selectedPlatform}
          data-test-id="platform-select-next"
        >
          {t('Configure SDK')}
        </Button>
      </ButtonWrapper>
    </GenericFooter>
  );
}

const SelectionWrapper = styled(motion.div)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

SelectionWrapper.defaultProps = {
  transition: testableTransition({
    duration: 1.8,
  }),
};

const ButtonWrapper = styled(motion.div)`
  display: flex;
  height: 100%;
  align-items: center;
  margin-right: ${space(4)};
  margin-left: ${space(4)};
`;

ButtonWrapper.defaultProps = {
  transition: testableTransition({
    duration: 1.3,
  }),
};

const SelectedPlatformIcon = styled(PlatformIcon)`
  margin-right: ${space(1)};
`;

const PlatformsSelected = styled('div')`
  margin-top: ${space(1)};
`;

const ClearButton = styled(Button)`
  margin-left: ${space(2)};
  padding: 0;
`;
