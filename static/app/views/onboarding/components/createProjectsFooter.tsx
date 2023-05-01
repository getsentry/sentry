import {Fragment, useCallback} from 'react';
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
import {SUPPORTED_LANGUAGES} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import {OnboardingSelectedSDK, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useProjects from 'sentry/utils/useProjects';
import useTeams from 'sentry/utils/useTeams';

import {OnboardingState} from '../types';
import {usePersistedOnboardingState} from '../utils';

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
  const [clientState, setClientState] = usePersistedOnboardingState();
  const {projects} = useProjects();

  const createPlatformProject = useCallback(
    async (selectedFramework?: OnboardingSelectedSDK) => {
      if (!clientState || !selectedPlatform) {
        // Do nothing if client state is not loaded yet.
        return;
      }

      const createProjectForPlatform = selectedFramework
        ? projects.find(p => p.platform === selectedFramework.key)
          ? undefined
          : selectedFramework
        : projects.find(p => p.platform === selectedPlatform.key)
        ? undefined
        : clientState.platformToProjectIdMap[selectedPlatform.key]
        ? undefined
        : selectedPlatform;

      if (!createProjectForPlatform) {
        const platform = selectedFramework ? selectedFramework : selectedPlatform;

        setClientState({
          platformToProjectIdMap: clientState.platformToProjectIdMap,
          selectedPlatform: platform,
          state: 'projects_selected',
          url: 'setup-docs/',
        });

        trackAnalytics('growth.onboarding_set_up_your_project', {
          platform: selectedPlatform.key,
          organization,
        });

        onComplete(platform);
        return;
      }

      try {
        addLoadingMessage(t('Creating project'));

        const response = await createProject({
          api,
          orgSlug: organization.slug,
          team: teams[0].slug,
          platform: createProjectForPlatform.key,
          name: createProjectForPlatform.key,
          options: {
            defaultRules: true,
          },
        });

        const nextState: OnboardingState = {
          platformToProjectIdMap: clientState.platformToProjectIdMap,
          selectedPlatform: createProjectForPlatform,
          state: 'projects_selected',
          url: 'setup-docs/',
        };

        nextState.platformToProjectIdMap[createProjectForPlatform.key] =
          createProjectForPlatform.key;

        setClientState(nextState);

        ProjectsStore.onCreateSuccess(response, organization.slug);

        trackAnalytics('growth.onboarding_set_up_your_project', {
          platform: selectedPlatform.key,
          organization,
        });

        clearIndicators();
        setTimeout(() => onComplete(createProjectForPlatform));
      } catch (err) {
        addErrorMessage(t('Failed to create project'));
        Sentry.captureException(err);
      }
    },
    [
      clientState,
      setClientState,
      selectedPlatform,
      api,
      organization,
      teams,
      projects,
      onComplete,
    ]
  );

  const handleProjectCreation = useCallback(async () => {
    if (!selectedPlatform) {
      return;
    }

    if (
      selectedPlatform.type !== 'language' ||
      !Object.values(SUPPORTED_LANGUAGES).includes(
        selectedPlatform.language as SUPPORTED_LANGUAGES
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
            createPlatformProject(selectedFramework);
          }}
          onSkip={createPlatformProject}
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
  }, [selectedPlatform, createPlatformProject, organization]);

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
              {t('1 platform selected')}
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
          {t('Create Project')}
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
