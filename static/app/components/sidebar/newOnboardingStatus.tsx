import {Fragment, useCallback, useContext, useEffect} from 'react';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {
  NewOnboardingSidebar,
  useOnboardingTasks,
} from 'sentry/components/onboardingWizard/newSidebar';
import ProgressRing, {
  RingBackground,
  RingBar,
  RingText,
} from 'sentry/components/progressRing';
import {ExpandedContext} from 'sentry/components/sidebar/expandedContextProvider';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoWalkthrough} from 'sentry/utils/demoMode';
import theme from 'sentry/utils/theme';
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
  const organization = useOrganization();
  const onboardingContext = useContext(OnboardingContext);
  const {projects} = useProjects();
  const {shouldAccordionFloat} = useContext(ExpandedContext);

  const isActive = currentPanel === SidebarPanelKey.ONBOARDING_WIZARD;
  const walkthrough = isDemoWalkthrough();

  const {allTasks, gettingStartedTasks, beyondBasicsTasks, completeTasks} =
    useOnboardingTasks(organization, projects, onboardingContext);

  const handleToggle = useCallback(() => {
    if (!walkthrough && !isActive === true) {
      trackAnalytics('quick_start.opened', {
        organization,
      });
    }
    onShowPanel();
  }, [walkthrough, isActive, onShowPanel, organization]);

  const label = walkthrough ? t('Guided Tours') : t('Onboarding');
  const totalRemainingTasks = allTasks.length - completeTasks.length;
  const pendingCompletionSeen = completeTasks.some(
    completeTask =>
      allTasks.some(task => task.task === completeTask.task) &&
      completeTask.status === 'complete' &&
      !completeTask.completionSeen
  );

  useEffect(() => {
    if (totalRemainingTasks !== 0 || isActive) {
      return;
    }

    trackAnalytics('quick_start.completed', {
      organization: organization,
      referrer: 'onboarding_sidebar',
    });
  }, [isActive, totalRemainingTasks, organization]);

  if (
    !organization.features?.includes('onboarding') ||
    (totalRemainingTasks === 0 && !isActive)
  ) {
    return null;
  }

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
          textCss={() => css`
            font-size: ${theme.fontSizeMedium};
            font-weight: ${theme.fontWeightBold};
          `}
          text={completeTasks.length}
          value={(completeTasks.length / allTasks.length) * 100}
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
                    totalCompletedTasks: completeTasks.length,
                  })
                : tct('[totalCompletedTasks] completed tasks', {
                    totalCompletedTasks: completeTasks.length,
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
          allTasks={allTasks}
          completeTasks={completeTasks}
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
