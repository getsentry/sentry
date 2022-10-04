import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {createProject} from 'sentry/actionCreators/projects';
import Button from 'sentry/components/button';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t, tn} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useTeams from 'sentry/utils/useTeams';

import {OnboardingState} from '../types';
import {usePersistedOnboardingState} from '../utils';

import GenericFooter from './genericFooter';

type Props = {
  clearPlatforms: () => void;
  genSkipOnboardingLink: () => React.ReactNode;
  onComplete: () => void;
  organization: Organization;
  platforms: PlatformKey[];
};

export default function CreateProjectsFooter({
  organization,
  platforms,
  onComplete,
  genSkipOnboardingLink,
  clearPlatforms,
}: Props) {
  const api = useApi();
  const {teams} = useTeams();
  const [persistedOnboardingState, setPersistedOnboardingState] =
    usePersistedOnboardingState();

  const createProjects = async () => {
    if (!persistedOnboardingState) {
      // Do nothing if client state is not loaded yet.
      return;
    }
    try {
      addLoadingMessage(t('Creating projects'));

      const responses = await Promise.all(
        platforms
          .filter(platform => !persistedOnboardingState.platformToProjectIdMap[platform])
          .map(platform =>
            createProject(api, organization.slug, teams[0].slug, platform, platform, {
              defaultRules: false,
            })
          )
      );
      const nextState: OnboardingState = {
        platformToProjectIdMap: persistedOnboardingState.platformToProjectIdMap,
        selectedPlatforms: platforms,
        state: 'projects_selected',
        url: 'setup-docs/',
      };
      responses.forEach(p => (nextState.platformToProjectIdMap[p.platform] = p.slug));
      setPersistedOnboardingState(nextState);

      responses.forEach(data => ProjectsStore.onCreateSuccess(data, organization.slug));

      trackAdvancedAnalyticsEvent('growth.onboarding_set_up_your_projects', {
        platforms: platforms.join(','),
        platform_count: platforms.length,
        organization,
      });
      clearIndicators();
      setTimeout(onComplete);
    } catch (err) {
      addErrorMessage(t('Failed to create projects'));
      Sentry.captureException(err);
    }
  };

  const renderPlatform = (platform: PlatformKey) => {
    platform = platform || 'other';
    return <SelectedPlatformIcon key={platform} platform={platform} size={23} />;
  };

  return (
    <GenericFooter>
      {genSkipOnboardingLink()}
      <SelectionWrapper>
        {platforms.length ? (
          <Fragment>
            <div>{platforms.map(renderPlatform)}</div>
            <PlatformSelected>
              {tn('%s platform selected', '%s platforms selected', platforms.length)}
              <ClearButton priority="link" onClick={clearPlatforms} size="zero">
                {t('Clear')}
              </ClearButton>
            </PlatformSelected>
          </Fragment>
        ) : null}
      </SelectionWrapper>
      <ButtonWrapper>
        <Button
          priority="primary"
          onClick={createProjects}
          disabled={platforms.length === 0}
          data-test-id="platform-select-next"
        >
          {tn('Create Project', 'Create Projects', platforms.length)}
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
`;

ButtonWrapper.defaultProps = {
  transition: testableTransition({
    duration: 1.3,
  }),
};

const SelectedPlatformIcon = styled(PlatformIcon)`
  margin-right: ${space(1)};
`;

const PlatformSelected = styled('div')`
  margin-top: ${space(1)};
`;

const ClearButton = styled(Button)`
  margin-left: ${space(2)};
`;
