import {useCallback, useContext, useEffect, useMemo} from 'react';
import type {Theme} from '@emotion/react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {LegacyOnboardingSidebar} from 'sentry/components/onboardingWizard/sidebar';
import {useOnboardingTasks} from 'sentry/components/onboardingWizard/useOnboardingTasks';
import ProgressRing, {
  RingBackground,
  RingBar,
  RingText,
} from 'sentry/components/progressRing';
import {ExpandedContext} from 'sentry/components/sidebar/expandedContextProvider';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useOnboardingSidebar} from 'sentry/views/onboarding/useOnboardingSidebar';

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
  const user = useUser();
  const theme = useTheme();
  const {mutate: mutateUserOptions} = useMutateUserOptions();
  const {activateSidebar} = useOnboardingSidebar();
  const organization = useOrganization();
  const {shouldAccordionFloat} = useContext(ExpandedContext);
  const [quickStartCompleted, setQuickStartCompleted] = useLocalStorageState(
    `quick-start:${organization.slug}:completed`,
    false
  );

  const isActive = currentPanel === SidebarPanelKey.ONBOARDING_WIZARD;
  const demoMode = isDemoModeEnabled();

  const {
    allTasks,
    gettingStartedTasks,
    beyondBasicsTasks,
    doneTasks,
    completeTasks,
    refetch,
  } = useOnboardingTasks({
    disabled: !isActive,
  });

  const label = demoMode ? t('Guided Tours') : t('Onboarding');
  const pendingCompletionSeen = doneTasks.length !== completeTasks.length;
  const allTasksCompleted = allTasks.length === completeTasks.length;

  const skipQuickStart =
    (!demoMode && !organization.features?.includes('onboarding')) ||
    (allTasksCompleted && !isActive);

  const orgId = organization.id;

  const quickStartDisplay = useMemo(() => {
    return user?.options?.quickStartDisplay ?? {};
  }, [user?.options?.quickStartDisplay]);

  const quickStartDisplayStatus = quickStartDisplay[orgId] ?? 0;

  const handleShowPanel = useCallback(() => {
    if (!demoMode && !isActive === true) {
      trackAnalytics('quick_start.opened', {
        organization,
      });
    }

    onShowPanel();
  }, [onShowPanel, isActive, demoMode, organization]);

  useEffect(() => {
    if (!allTasksCompleted || skipQuickStart || quickStartCompleted) {
      return;
    }

    if (demoMode) {
      return;
    }

    trackAnalytics('quick_start.completed', {
      organization,
      referrer: 'onboarding_sidebar',
    });

    setQuickStartCompleted(true);
  }, [
    demoMode,
    organization,
    skipQuickStart,
    quickStartCompleted,
    setQuickStartCompleted,
    allTasksCompleted,
  ]);

  useEffect(() => {
    if (skipQuickStart || quickStartDisplayStatus > 1) {
      return;
    }

    const newQuickStartDisplay = {...quickStartDisplay};
    newQuickStartDisplay[orgId] = quickStartDisplayStatus + 1;

    mutateUserOptions({['quickStartDisplay']: newQuickStartDisplay});

    if (quickStartDisplayStatus === 1) {
      activateSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutateUserOptions, activateSidebar, orgId, skipQuickStart]);

  if (skipQuickStart) {
    return null;
  }

  return (
    <GuideAnchor target="onboarding_sidebar" position="right">
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
          animate
          textCss={() => css`
            font-size: ${theme.fontSizeMedium};
            font-weight: ${theme.fontWeightBold};
          `}
          text={
            doneTasks.length === allTasks.length ? <IconCheckmark /> : doneTasks.length
          }
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
              {demoMode
                ? tn(
                    '%s remaining tour',
                    '%s remaining tours',
                    allTasks.length - doneTasks.length
                  )
                : tn('%s completed task', '%s completed tasks', doneTasks.length)}
              {pendingCompletionSeen && (
                <PendingSeenIndicator data-test-id="pending-seen-indicator" />
              )}
            </Remaining>
          </div>
        )}
      </Container>
      {isActive && (
        <LegacyOnboardingSidebar
          orientation={orientation}
          collapsed={collapsed}
          onClose={hidePanel}
          gettingStartedTasks={gettingStartedTasks}
          beyondBasicsTasks={beyondBasicsTasks}
          title={label}
        />
      )}
    </GuideAnchor>
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
