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
import ProjectActions from 'sentry/actions/projectActions';
import Button from 'sentry/components/button';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useTeams from 'sentry/utils/useTeams';

import {ClientState, fetchClientState} from '../types';

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

  const createProjects = async () => {
    try {
      addLoadingMessage(t('Creating projects'));

      const lastState: ClientState = await fetchClientState(api, organization.slug);
      const responses = await Promise.all(
        platforms
          .filter(platform => !lastState.platformToProjectIdMap[platform])
          .map(platform =>
            createProject(api, organization.slug, teams[0].slug, platform, platform)
          )
      );
      const nextState: ClientState = {
        platformToProjectIdMap: lastState.platformToProjectIdMap,
        selectedPlatforms: platforms,
      };
      responses.forEach(p => (nextState.platformToProjectIdMap[p.platform] = p.slug));
      await api.requestPromise(
        `/organizations/${organization.slug}/client-state/onboarding/`,
        {
          method: 'PUT',
          data: nextState,
        }
      );

      responses.map(ProjectActions.createSuccess);
      trackAdvancedAnalyticsEvent('growth.onboarding_set_up_your_projects', {
        platforms: platforms.join(','),
        organization,
      });
      clearIndicators();
      onComplete();
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
