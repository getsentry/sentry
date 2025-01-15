import {Fragment, useCallback, useContext, useEffect} from 'react';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {OnboardingSidebar} from 'sentry/components/onboardingWizard/sidebar';
import {getMergedTasks} from 'sentry/components/onboardingWizard/taskConfig';
import {useOnboardingTasks} from 'sentry/components/onboardingWizard/useOnboardingTasks';
import {findCompleteTasks} from 'sentry/components/onboardingWizard/utils';
import ProgressRing, {
  RingBackground,
  RingBar,
  RingText,
} from 'sentry/components/progressRing';
import {ExpandedContext} from 'sentry/components/sidebar/expandedContextProvider';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import theme from 'sentry/utils/theme';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import type {CommonSidebarProps} from './types';
import {SidebarPanelKey} from './types';

type OnboardingStatusProps = CommonSidebarProps;

export function OnboardingStatus({
  collapsed,
  currentPanel,
  orientation,
  hidePanel,
  onShowPanel,
}: OnboardingStatusProps) {
  const organization = useOrganization();
  const onboardingContext = useContext(OnboardingContext);
  const {projects} = useProjects();
  const {shouldAccordionFloat} = useContext(ExpandedContext);
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

  const handleShowPanel = useCallback(() => {
    if (!walkthrough && !isActive === true) {
      trackAnalytics('quick_start.opened', {
        organization,
      });
    }

    onShowPanel();
  }, [onShowPanel, isActive, walkthrough, organization]);

  useEffect(() => {
    if (!allTasksCompleted || skipQuickStart || quickStartCompleted) {
      return;
    }

    trackAnalytics('quick_start.completed', {
      organization,
      referrer: 'onboarding_sidebar',
    });

    setQuickStartCompleted(true);
  }, [
    organization,
    skipQuickStart,
    quickStartCompleted,
    setQuickStartCompleted,
    allTasksCompleted,
  ]);

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
        showText={!shouldAccordionFloat}
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
            <Remaining role="status">
              {walkthrough
                ? tn('%s completed tour', '%s completed tours', doneTasks.length)
                : tn('%s completed task', '%s completed tasks', doneTasks.length)}
              {pendingCompletionSeen && (
                <PendingSeenIndicator data-test-id="pending-seen-indicator" />
              )}
            </Remaining>
          </div>
        )}
      </Container>
      {isActive && (
        <OnboardingSidebar
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

const Container = styled('div')<{isActive: boolean; showText: boolean}>`
  padding: 9px 16px;
  cursor: pointer;
  display: grid;
  grid-template-columns: ${p => (p.showText ? 'max-content 1fr' : 'max-content')};
  gap: ${space(1.5)};
  align-items: center;
  transition: background 100ms;

  ${p => p.isActive && hoverCss(p)};

  &:hover {
    ${hoverCss};
  }
`;
