import {Fragment, useCallback, useContext, useEffect} from 'react';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import OnboardingSidebar from 'sentry/components/onboardingWizard/sidebar';
import {getMergedTasks} from 'sentry/components/onboardingWizard/taskConfig';
import ProgressRing, {
  RingBackground,
  RingBar,
  RingText,
} from 'sentry/components/progressRing';
import {ExpandedContext} from 'sentry/components/sidebar/expandedContextProvider';
import {isDone} from 'sentry/components/sidebar/utils';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import theme from 'sentry/utils/theme';
import useProjects from 'sentry/utils/useProjects';

import type {CommonSidebarProps} from './types';
import {SidebarPanelKey} from './types';

type Props = CommonSidebarProps & {
  org: Organization;
};

const progressTextCss = () => css`
  font-size: ${theme.fontSizeMedium};
  font-weight: ${theme.fontWeightBold};
`;

export default function OnboardingStatus({
  collapsed,
  org,
  currentPanel,
  orientation,
  hidePanel,
  onShowPanel,
}: Props) {
  const onboardingContext = useContext(OnboardingContext);
  const {projects} = useProjects();
  const {shouldAccordionFloat} = useContext(ExpandedContext);

  const isActive = currentPanel === SidebarPanelKey.ONBOARDING_WIZARD;
  const walkthrough = isDemoModeEnabled();

  const handleToggle = useCallback(() => {
    if (!walkthrough && !isActive === true) {
      trackAnalytics('quick_start.opened', {
        organization: org,
        new_experience: false,
      });
    }
    onShowPanel();
  }, [walkthrough, isActive, onShowPanel, org]);

  const tasks = getMergedTasks({
    organization: org,
    projects,
    onboardingContext,
  });

  const allDisplayedTasks = tasks.filter(task => task.display);

  const doneTasks = allDisplayedTasks.filter(isDone);
  const numberRemaining = allDisplayedTasks.length - doneTasks.length;

  const pendingCompletionSeen = doneTasks.some(
    task =>
      allDisplayedTasks.some(displayedTask => displayedTask.task === task.task) &&
      task.status === 'complete' &&
      !task.completionSeen
  );

  const allTasksCompleted = doneTasks.length >= allDisplayedTasks.length;

  useEffect(() => {
    if (!allTasksCompleted || isActive) {
      return;
    }

    trackAnalytics('quick_start.completed', {
      organization: org,
      referrer: 'onboarding_sidebar',
      new_experience: false,
    });
  }, [isActive, allTasksCompleted, org]);

  if (!org.features?.includes('onboarding') || (allTasksCompleted && !isActive)) {
    return null;
  }

  const label = walkthrough ? t('Guided Tours') : t('Quick Start');
  const task = walkthrough ? 'tours' : 'tasks';

  return (
    <Fragment>
      <Container
        role="button"
        aria-label={label}
        onClick={handleToggle}
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
        {!shouldAccordionFloat && (
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
