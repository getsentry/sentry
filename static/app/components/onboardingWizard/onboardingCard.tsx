import React, {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import Card from 'sentry/components/card';
import Link from 'sentry/components/links/link';
import {IconChevron, IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import withProjects from 'sentry/utils/withProjects';
import {usePersistedOnboardingState} from 'sentry/views/onboarding/targetedOnboarding/types';

const MAX_PROJECT_COUNT = 3;

function OnboardingViewTask(props: {orgSlug: string; projects: Project[]}) {
  const [onboardingState] = usePersistedOnboardingState();
  if (!onboardingState) {
    return null;
  }
  // Projects selected during onboarding but not received first event
  const projects = onboardingState.selectedPlatforms
    .map(platform => onboardingState.platformToProjectIdMap[platform])
    .map(projectId => props.projects.find(p => p.slug === projectId))
    .filter(project => project && !project.firstEvent) as Project[];
  return projects.length > 0 ? (
    <Fragment>
      <Heading>{t('Setup Projects')}</Heading>
      <TaskCard key="onboarding-continue-card">
        <OnboardingTaskProjectList>
          {projects.slice(0, MAX_PROJECT_COUNT).map(p => (
            <OnboardingTaskProjectListItem
              key={p.id}
              to={`/onboarding/${props.orgSlug}/setup-docs/?project_id=${p.id}`}
            >
              <OnboardingTaskProjectListItemInner>
                <PlatformIcon platform={p.platform || 'default'} />
                {p.slug}
                <PulsingIndicator />
                <PulsingIndicatorText>{t('Waiting for event')}</PulsingIndicatorText>
                <IconChevron direction="right" />
              </OnboardingTaskProjectListItemInner>
            </OnboardingTaskProjectListItem>
          ))}
          {projects.length > MAX_PROJECT_COUNT && (
            <OnboardingTaskProjectListItem
              to={`/onboarding/${props.orgSlug}/setup-docs/`}
            >
              <OnboardingTaskProjectListItemInner>
                <IconEllipsis />
                {tct('and [num] more', {num: projects.length - MAX_PROJECT_COUNT})}
              </OnboardingTaskProjectListItemInner>
            </OnboardingTaskProjectListItem>
          )}
        </OnboardingTaskProjectList>
      </TaskCard>
    </Fragment>
  ) : null;
}

const Heading = styled(motion.div)`
  display: flex;
  color: ${p => p.theme.purple300};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-transform: uppercase;
  font-weight: 600;
  line-height: 1;
  margin-top: ${space(3)};
`;

const TaskCard = styled(motion(Card))`
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const OnboardingTaskProjectList = styled('div')`
  display: flex;
  flex-direction: column;
`;

const OnboardingTaskProjectListItemInner = styled('div')`
  padding: ${space(1)} 0;

  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
const OnboardingTaskProjectListItem = styled(Link)`
  :hover {
    background-color: ${p => p.theme.hover};
  }
  padding: 0 ${space(3)};
  color: ${p => p.theme.textColor};

  :not(:last-child) {
    ${OnboardingTaskProjectListItemInner} {
      border-bottom: 1px solid ${p => p.theme.innerBorder};
    }
  }
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  margin-left: auto;
`;
const PulsingIndicatorText = styled('span')`
  color: ${p => p.theme.pink300};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default withProjects(OnboardingViewTask);
