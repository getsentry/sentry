import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import {Button} from 'sentry/components/button';
import Card from 'sentry/components/card';
import Link from 'sentry/components/links/link';
import {IconChevron, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import {OnboardingCustomComponentProps} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';

import SkipConfirm from './skipConfirm';

export default function OnboardingProjectsCard({
  organization: org,
  onboardingContext,
  projects: allProjects,
}: OnboardingCustomComponentProps) {
  const handleSkip = () => {
    onboardingContext.setData({
      ...onboardingContext.data,
      selectedSDK: undefined,
    });
  };

  // TODO(Priscila): Reflect on this logic
  const selectedProjectSlug = onboardingContext.data.selectedSDK?.key;

  const project = selectedProjectSlug
    ? allProjects.find(p => p.slug === selectedProjectSlug)
    : undefined;

  // Project selected during onboarding but not received first event
  const projectHasFirstEvent = !project?.firstEvent;

  if (!project || !projectHasFirstEvent) {
    return null;
  }

  return (
    <TaskCard key="onboarding-continue-card">
      <Title>{t('Project to Setup')}</Title>
      <OnboardingTaskProjectList>
        <OnboardingTaskProjectListItem
          to={`/onboarding/${org.slug}/setup-docs/?project_id=${project.id}`}
          onClick={() => {
            trackAnalytics('growth.onboarding_quick_start_cta', {
              platform: project.platform,
              organization: org,
            });
          }}
        >
          <OnboardingTaskProjectListItemInner>
            <StyledPlatformIcon platform={project.platform || 'default'} />
            {project.slug}
            <PulsingIndicator />
            <PulsingIndicatorText>{t('Waiting for event')}</PulsingIndicatorText>
            <IconChevron direction="right" />
          </OnboardingTaskProjectListItemInner>
        </OnboardingTaskProjectListItem>
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
  );
}

const Heading = styled(motion.div)`
  display: flex;
  color: ${p => p.theme.activeText};
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
  padding-bottom: ${space(1)};
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
  border-radius: 0;
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
  color: ${p => p.theme.pink400};
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
