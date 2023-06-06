import {Fragment, useContext} from 'react';
import {css, Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import OnboardingSidebar from 'sentry/components/onboardingWizard/sidebar';
import {getMergedTasks} from 'sentry/components/onboardingWizard/taskConfig';
import ProgressRing, {
  RingBackground,
  RingBar,
  RingText,
} from 'sentry/components/progressRing';
import {isDone} from 'sentry/components/sidebar/utils';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoWalkthrough} from 'sentry/utils/demoMode';
import theme from 'sentry/utils/theme';
import withProjects from 'sentry/utils/withProjects';

import {CommonSidebarProps, SidebarPanelKey} from './types';

type Props = CommonSidebarProps & {
  org: Organization;
  projects: Project[];
};

const progressTextCss = () => css`
  font-size: ${theme.fontSizeMedium};
  font-weight: bold;
`;

function OnboardingStatus({
  collapsed,
  org,
  projects,
  currentPanel,
  orientation,
  hidePanel,
  onShowPanel,
}: Props) {
  const handleShowPanel = () => {
    trackAnalytics('onboarding.wizard_opened', {organization: org});
    onShowPanel();
  };
  const onboardingContext = useContext(OnboardingContext);

  if (!org.features?.includes('onboarding')) {
    return null;
  }

  const tasks = getMergedTasks({
    organization: org,
    projects,
    onboardingContext,
  });

  const allDisplayedTasks = tasks
    .filter(task => task.display)
    .filter(task => !task.renderCard);
  const doneTasks = allDisplayedTasks.filter(isDone);
  const numberRemaining = allDisplayedTasks.length - doneTasks.length;

  const pendingCompletionSeen = doneTasks.some(
    task =>
      allDisplayedTasks.some(displayedTask => displayedTask.task === task.task) &&
      task.status === 'complete' &&
      !task.completionSeen
  );

  const isActive = currentPanel === SidebarPanelKey.ONBOARDING_WIZARD;

  if (doneTasks.length >= allDisplayedTasks.length && !isActive) {
    return null;
  }

  const walkthrough = isDemoWalkthrough();
  const label = walkthrough ? t('Guided Tours') : t('Quick Start');
  const task = walkthrough ? 'tours' : 'tasks';

  return (
    <Fragment>
      <Container
        role="button"
        aria-label={label}
        onClick={handleShowPanel}
        isActive={isActive}
      >
        <ProgressRing
          animateText
          textCss={progressTextCss}
          text={allDisplayedTasks.length - doneTasks.length}
          value={(doneTasks.length / allDisplayedTasks.length) * 100}
          backgroundColor="rgba(255, 255, 255, 0.15)"
          progressEndcaps="round"
          size={38}
          barWidth={6}
        />
        {!collapsed && (
          <div>
            <Heading>{label}</Heading>
            <Remaining>
              {tct('[numberRemaining] Remaining [task]', {numberRemaining, task})}
              {pendingCompletionSeen && <PendingSeenIndicator />}
            </Remaining>
          </div>
        )}
      </Container>
      {isActive && (
        <OnboardingSidebar
          orientation={orientation}
          collapsed={collapsed}
          onClose={hidePanel}
        />
      )}
    </Fragment>
  );
}

const Heading = styled('div')`
  transition: color 100ms;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.white};
  margin-bottom: ${space(0.25)};
`;

const Remaining = styled('div')`
  transition: color 100ms;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  display: grid;
  grid-template-columns: max-content max-content;
  gap: ${space(0.75)};
  align-items: center;
`;

const PendingSeenIndicator = styled('div')`
  background: ${p => p.theme.red300};
  border-radius: 50%;
  height: 7px;
  width: 7px;
`;

const hoverCss = (p: {theme: Theme}) => css`
  background: rgba(255, 255, 255, 0.05);

  ${RingBackground} {
    stroke: rgba(255, 255, 255, 0.3);
  }
  ${RingBar} {
    stroke: ${p.theme.green200};
  }
  ${RingText} {
    color: ${p.theme.white};
  }

  ${Heading} {
    color: ${p.theme.white};
  }
  ${Remaining} {
    color: ${p.theme.white};
  }
`;

const Container = styled('div')<{isActive: boolean}>`
  padding: 9px 19px 9px 16px;
  cursor: pointer;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1.5)};
  align-items: center;
  transition: background 100ms;

  ${p => p.isActive && hoverCss(p)};

  &:hover {
    ${hoverCss};
  }
`;

export default withProjects(OnboardingStatus);
