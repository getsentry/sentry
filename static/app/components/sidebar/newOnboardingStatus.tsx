import {Fragment, useCallback, useContext, useEffect, useMemo, useRef} from 'react';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {updateOnboardingTask} from 'sentry/actionCreators/onboardingTasks';
import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {NewOnboardingSidebar} from 'sentry/components/onboardingWizard/newSidebar';
import {getMergedTasks} from 'sentry/components/onboardingWizard/taskConfig';
import {useOnboardingTasks} from 'sentry/components/onboardingWizard/useOnboardingTasks';
import {findCompleteTasks, taskIsDone} from 'sentry/components/onboardingWizard/utils';
import ProgressRing, {
  RingBackground,
  RingBar,
  RingText,
} from 'sentry/components/progressRing';
import {ExpandedContext} from 'sentry/components/sidebar/expandedContextProvider';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import theme from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import type {CommonSidebarProps} from './types';
import {SidebarPanelKey} from './types';

type NewOnboardingStatusProps = CommonSidebarProps;

export function NewOnboardingStatus({
  collapsed,
  currentPanel,
  orientation,
  hidePanel,
  onShowPanel,
}: NewOnboardingStatusProps) {
  const api = useApi();
  const organization = useOrganization();
  const onboardingContext = useContext(OnboardingContext);
  const {projects} = useProjects();
  const {shouldAccordionFloat} = useContext(ExpandedContext);
  const hasMarkedUnseenTasksAsComplete = useRef(false);
  const [quickStartCompleted, setQuickStartCompleted] = useLocalStorageState(
    `quick-start:${organization.slug}:completed`,
    false
  );

  const isActive = currentPanel === SidebarPanelKey.ONBOARDING_WIZARD;
  const walkthrough = isDemoModeEnabled();

  const supportedTasks = getMergedTasks({
    organization,
    projects,
    onboardingContext,
  }).filter(task => task.display);

  const {
    allTasks,
    gettingStartedTasks,
    beyondBasicsTasks,
    doneTasks,
    completeTasks,
    refetch,
  } = useOnboardingTasks({
    supportedTasks,
    enabled:
      !!organization.features?.includes('onboarding') &&
      !supportedTasks.every(findCompleteTasks) &&
      isActive,
  });

  const label = walkthrough ? t('Guided Tours') : t('Onboarding');
  const pendingCompletionSeen = doneTasks.length !== completeTasks.length;
  const allTasksCompleted = allTasks.length === completeTasks.length;

  const skipQuickStart =
    !organization.features?.includes('onboarding') || (allTasksCompleted && !isActive);

  const unseenDoneTasks = useMemo(
    () =>
      allTasks
        .filter(task => taskIsDone(task) && !task.completionSeen)
        .map(task => task.task),
    [allTasks]
  );

  const markDoneTaskAsComplete = useCallback(() => {
    for (const unseenDoneTask of unseenDoneTasks) {
      updateOnboardingTask(api, organization, {
        task: unseenDoneTask,
        completionSeen: true,
      });
    }
  }, [api, organization, unseenDoneTasks]);

  const handleShowPanel = useCallback(() => {
    if (!walkthrough && !isActive === true) {
      trackAnalytics('quick_start.opened', {
        organization,
        new_experience: true,
      });
    }

    markDoneTaskAsComplete();

    onShowPanel();
  }, [onShowPanel, isActive, walkthrough, markDoneTaskAsComplete, organization]);

  useEffect(() => {
    if (!allTasksCompleted || skipQuickStart || quickStartCompleted) {
      return;
    }

    trackAnalytics('quick_start.completed', {
      organization: organization,
      referrer: 'onboarding_sidebar',
      new_experience: true,
    });

    setQuickStartCompleted(true);
  }, [
    organization,
    skipQuickStart,
    quickStartCompleted,
    setQuickStartCompleted,
    allTasksCompleted,
  ]);

  useEffect(() => {
    if (pendingCompletionSeen && isActive && !hasMarkedUnseenTasksAsComplete.current) {
      markDoneTaskAsComplete();
      hasMarkedUnseenTasksAsComplete.current = true;
    }

    if (!pendingCompletionSeen || !isActive) {
      hasMarkedUnseenTasksAsComplete.current = false;
    }
  }, [isActive, pendingCompletionSeen, markDoneTaskAsComplete]);

  if (skipQuickStart) {
    return null;
  }

  return (
    <Fragment>
      <Container
        role="button"
        aria-label={label}
        onClick={handleShowPanel}
        isActive={isActive}
        onMouseEnter={() => {
          refetch();
        }}
      >
        <ProgressRing
          animateText
          textCss={() => css`
            font-size: ${theme.fontSizeMedium};
            font-weight: ${theme.fontWeightBold};
          `}
          text={doneTasks.length}
          value={(doneTasks.length / allTasks.length) * 100}
          backgroundColor="rgba(255, 255, 255, 0.15)"
          progressEndcaps="round"
          size={38}
          barWidth={6}
        />
        {!shouldAccordionFloat && (
          <div>
            <Heading>{label}</Heading>
            <Remaining>
              {walkthrough
                ? tct('[totalCompletedTasks] completed tours', {
                    totalCompletedTasks: doneTasks.length,
                  })
                : tct('[totalCompletedTasks] completed tasks', {
                    totalCompletedTasks: doneTasks.length,
                  })}
              {pendingCompletionSeen && <PendingSeenIndicator />}
            </Remaining>
          </div>
        )}
      </Container>
      {isActive && (
        <NewOnboardingSidebar
          orientation={orientation}
          collapsed={collapsed}
          onClose={hidePanel}
          gettingStartedTasks={gettingStartedTasks}
          beyondBasicsTasks={beyondBasicsTasks}
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
