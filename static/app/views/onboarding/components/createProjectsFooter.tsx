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
import TextOverflow from 'sentry/components/textOverflow';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t, tct, tn} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import {OnboardingSelectedPlatform, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import getPlatformName from 'sentry/utils/getPlatformName';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useProjects from 'sentry/utils/useProjects';
import useTeams from 'sentry/utils/useTeams';

import {OnboardingState} from '../types';
import {usePersistedOnboardingState} from '../utils';

import GenericFooter from './genericFooter';

type Props = {
  clearPlatforms: () => void;
  genSkipOnboardingLink: () => React.ReactNode;
  onComplete: (selectedPlatforms: OnboardingSelectedPlatform[]) => void;
  organization: Organization;
  selectedPlatforms: OnboardingSelectedPlatform[];
};

export function CreateProjectsFooter({
  organization,
  selectedPlatforms,
  onComplete,
  genSkipOnboardingLink,
  clearPlatforms,
}: Props) {
  const singleSelectPlatform = !!organization?.features.includes(
    'onboarding-remove-multiselect-platform'
  );
  const frameworkSelectionEnabled = !!organization?.features.includes(
    'onboarding-sdk-selection'
  );

  const api = useApi();
  const {teams} = useTeams();
  const [clientState, setClientState] = usePersistedOnboardingState();
  const {projects} = useProjects();

  const createProjects = useCallback(
    async (selectedFramework?: OnboardingSelectedPlatform) => {
      if (!clientState) {
        // Do nothing if client state is not loaded yet.
        return;
      }

      const createProjectForPlatforms = selectedFramework
        ? projects.find(p => p.platform === selectedFramework.key)
          ? []
          : [selectedFramework]
        : selectedPlatforms
            .filter(platform => !clientState.platformToProjectIdMap[platform.key])
            // filter out platforms that already have a project
            .filter(platform => !projects.find(p => p.platform === platform.key));

      if (createProjectForPlatforms.length === 0) {
        setClientState({
          platformToProjectIdMap: clientState.platformToProjectIdMap,
          selectedPlatforms: selectedFramework
            ? [selectedFramework]
            : clientState.selectedPlatforms,
          state: 'projects_selected',
          url: 'setup-docs/',
        });
        trackAnalytics('growth.onboarding_set_up_your_projects', {
          platforms: selectedPlatforms.join(','),
          platform_count: selectedPlatforms.length,
          organization,
        });
        onComplete(
          selectedFramework ? [selectedFramework] : clientState.selectedPlatforms
        );
        return;
      }

      try {
        addLoadingMessage(
          singleSelectPlatform ? t('Creating project') : t('Creating projects')
        );

        const responses = await Promise.all(
          createProjectForPlatforms.map(p =>
            createProject(api, organization.slug, teams[0].slug, p.key, p.key, {
              defaultRules: true,
            })
          )
        );

        const nextState: OnboardingState = {
          platformToProjectIdMap: clientState.platformToProjectIdMap,
          selectedPlatforms: createProjectForPlatforms,
          state: 'projects_selected',
          url: 'setup-docs/',
        };
        responses.forEach(p => (nextState.platformToProjectIdMap[p.platform] = p.slug));
        setClientState(nextState);

        responses.forEach(data => ProjectsStore.onCreateSuccess(data, organization.slug));

        trackAnalytics('growth.onboarding_set_up_your_projects', {
          platforms: selectedPlatforms.join(','),
          platform_count: selectedPlatforms.length,
          organization,
        });
        clearIndicators();
        setTimeout(() => onComplete(createProjectForPlatforms));
      } catch (err) {
        addErrorMessage(
          singleSelectPlatform
            ? t('Failed to create project')
            : t('Failed to create projects')
        );
        Sentry.captureException(err);
      }
    },
    [
      clientState,
      setClientState,
      selectedPlatforms,
      api,
      organization,
      teams,
      projects,
      onComplete,
      singleSelectPlatform,
    ]
  );

  const handleProjectCreation = useCallback(async () => {
    // we assume that the single select platform is always enabled here
    const selectedPlatform = selectedPlatforms[0];

    if (
      selectedPlatform.type !== 'language' ||
      !Object.values(SUPPORTED_LANGUAGES).includes(
        selectedPlatform.language as SUPPORTED_LANGUAGES
      )
    ) {
      createProjects();
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
            createProjects(selectedFramework);
          }}
          onSkip={createProjects}
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
  }, [selectedPlatforms, createProjects, organization]);

  const renderPlatform = (platform: PlatformKey) => {
    platform = platform || 'other';
    return <SelectedPlatformIcon key={platform} platform={platform} size={23} />;
  };

  return (
    <GenericFooter>
      {genSkipOnboardingLink()}
      <SelectionWrapper>
        {selectedPlatforms.length ? (
          singleSelectPlatform ? (
            <Fragment>
              <div>
                {selectedPlatforms.map(selectedPlatform =>
                  renderPlatform(selectedPlatform.key)
                )}
              </div>
              <PlatformSelected>
                {tct('[platform] selected', {
                  platform: (
                    <PlatformName>
                      {getPlatformName(selectedPlatforms[0].key) ?? 'other'}
                    </PlatformName>
                  ),
                })}
                <ClearButton priority="link" onClick={clearPlatforms} size="zero">
                  {t('Clear')}
                </ClearButton>
              </PlatformSelected>
            </Fragment>
          ) : (
            <Fragment>
              <div>
                {selectedPlatforms.map(selectedPlatform =>
                  renderPlatform(selectedPlatform.key)
                )}
              </div>
              <PlatformsSelected>
                {tn(
                  '%s platform selected',
                  '%s platforms selected',
                  selectedPlatforms.length
                )}
                <ClearButton priority="link" onClick={clearPlatforms} size="zero">
                  {t('Clear')}
                </ClearButton>
              </PlatformsSelected>
            </Fragment>
          )
        ) : null}
      </SelectionWrapper>
      <ButtonWrapper>
        {singleSelectPlatform ? (
          <Button
            priority="primary"
            onClick={() =>
              frameworkSelectionEnabled ? handleProjectCreation() : createProjects()
            }
            disabled={selectedPlatforms.length === 0}
            data-test-id="platform-select-next"
            title={
              selectedPlatforms.length === 0
                ? t('Select the platform you want to monitor')
                : undefined
            }
          >
            {t('Create Project')}
          </Button>
        ) : (
          <Button
            priority="primary"
            onClick={() =>
              frameworkSelectionEnabled ? handleProjectCreation() : createProjects()
            }
            disabled={selectedPlatforms.length === 0}
            data-test-id="platform-select-next"
          >
            {tn('Create Project', 'Create Projects', selectedPlatforms.length)}
          </Button>
        )}
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

const PlatformSelected = styled('div')`
  margin-top: ${space(1)};
  display: grid;
  grid-template-columns: 1fr max-content max-content;
  align-items: center;
`;

const ClearButton = styled(Button)`
  margin-left: ${space(2)};
  padding: 0;
`;

const PlatformName = styled(TextOverflow)`
  margin-right: ${space(0.5)};
`;
