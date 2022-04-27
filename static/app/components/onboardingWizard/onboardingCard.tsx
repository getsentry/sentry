import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import Button from 'sentry/components/button';
import Card from 'sentry/components/card';
import Link from 'sentry/components/links/link';
import {IconChevron, IconClose, IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useProjects from 'sentry/utils/useProjects';
import {usePersistedOnboardingState} from 'sentry/views/onboarding/targetedOnboarding/utils';

import SkipConfirm from './skipConfirm';

const MAX_PROJECT_COUNT = 3;

type Props = {
  org: Organization;
};

// Warning: OnboardingViewTask and InternalOnboardingViewTask were split into two because useProjects
// hook was being conditionally called. This is no longer allowed and we need to lift the return into
// a separate component higher in the tree.
function OnboardingViewTask(props: Props) {
  if (!props.org?.experiments.TargetedOnboardingMultiSelectExperiment) {
    return null;
  }

  return <InternalOnboardingViewTask {...props} />;
}

function InternalOnboardingViewTask({org}: Props) {
  const [onboardingState, setOnboardingState] = usePersistedOnboardingState();
  const {projects: allProjects} = useProjects({orgId: org.id});

  if (!onboardingState) {
    return null;
  }

  const handleSkip = () => {
    setOnboardingState({
      ...onboardingState,
      selectedPlatforms: [],
    });
  };
  // Projects selected during onboarding but not received first event
  const projects = onboardingState.selectedPlatforms
    .map(platform => onboardingState.platformToProjectIdMap[platform])
    .map(projectId => allProjects.find(p => p.slug === projectId))
    .filter(project => project && !project.firstEvent) as Project[];
  return (
    <AnimatePresence>
      {projects.length > 0 && <Heading>{t('The Basics')}</Heading>}
      {projects.length > 0 && (
        <TaskCard key="onboarding-continue-card">
          <Title>{t('Project to Setup')}</Title>
          <OnboardingTaskProjectList>
            {projects.slice(0, MAX_PROJECT_COUNT).map(p => (
              <OnboardingTaskProjectListItem
                key={p.id}
                to={`/onboarding/${org.slug}/setup-docs/?project_id=${p.id}`}
                onClick={() => {
                  trackAdvancedAnalyticsEvent('growth.onboarding_quick_start_cta', {
                    platform: p.platform,
                    organization: org,
                  });
                }}
              >
                <OnboardingTaskProjectListItemInner>
                  <StyledPlatformIcon platform={p.platform || 'default'} />
                  {p.slug}
                  <PulsingIndicator />
                  <PulsingIndicatorText>{t('Waiting for event')}</PulsingIndicatorText>
                  <IconChevron direction="right" />
                </OnboardingTaskProjectListItemInner>
              </OnboardingTaskProjectListItem>
            ))}
            {projects.length > MAX_PROJECT_COUNT && (
              <OnboardingTaskProjectListItem
                to={`/onboarding/${org.slug}/setup-docs/`}
                onClick={() => {
                  trackAdvancedAnalyticsEvent('growth.onboarding_quick_start_cta', {
                    organization: org,
                  });
                }}
              >
                <OnboardingTaskProjectListItemInner>
                  <StyledAndMoreIcon />
                  {tct('and [num] more', {num: projects.length - MAX_PROJECT_COUNT})}
                </OnboardingTaskProjectListItemInner>
              </OnboardingTaskProjectListItem>
            )}
          </OnboardingTaskProjectList>
          <SkipConfirm onSkip={handleSkip}>
            {({skip}) => (
              <CloseButton
                borderless
                size="zero"
                aria-label={t('Close')}
                icon={<IconClose size="xs" />}
                onClick={skip}
              />
            )}
          </SkipConfirm>
        </TaskCard>
      )}
    </AnimatePresence>
  );
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
Heading.defaultProps = {
  exit: 'exit',
  variants: {
    exit: {
      height: 0,
      marginTop: 0,
      opacity: 0,
      transition: {duration: 0.3},
    },
  },
};

const Title = styled('div')`
  font-weight: 600;
  margin: ${space(2)} ${space(3)} 0;
`;

const TaskCard = styled(motion(Card))`
  position: relative;
  overflow: visible;
  display: flex;
  flex-direction: column;
`;
TaskCard.defaultProps = {
  exit: 'exit',
  variants: {
    exit: {
      height: 0,
      overflow: 'hidden',
      transition: {duration: 0.3},
    },
  },
};

const OnboardingTaskProjectList = styled('div')`
  display: flex;
  flex-direction: column;
`;

const OnboardingTaskProjectListItemInner = styled('div')`
  padding: ${space(1)} 0;

  display: flex;
  align-items: center;
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
  margin: 0 ${space(1)};
`;
const CloseButton = styled(Button)`
  position: absolute;
  right: ${space(1.5)};
  top: ${space(1.5)};
  color: ${p => p.theme.gray300};
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  margin-right: ${space(1)};
`;

const StyledAndMoreIcon = styled(IconEllipsis)`
  margin-right: ${space(1)};
`;

export default OnboardingViewTask;
