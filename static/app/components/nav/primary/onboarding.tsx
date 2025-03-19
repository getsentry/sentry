import {useEffect, useMemo} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useNavContext} from 'sentry/components/nav/context';
import {
  NavButton,
  SidebarItem,
  SidebarItemUnreadIndicator,
} from 'sentry/components/nav/primary/components';
import {
  PrimaryButtonOverlay,
  usePrimaryButtonOverlay,
} from 'sentry/components/nav/primary/primaryButtonOverlay';
import {NavLayout} from 'sentry/components/nav/types';
import {OnboardingSidebarContent} from 'sentry/components/onboardingWizard/content';
import {useOnboardingTasks} from 'sentry/components/onboardingWizard/useOnboardingTasks';
import ProgressRing from 'sentry/components/progressRing';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {OnboardingTask} from 'sentry/types/onboarding';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useOnboardingSidebar} from 'sentry/views/onboarding/useOnboardingSidebar';

function OnboardingItem({
  allTasks,
  doneTasks,
  completeTasks,
  isActive,
  refetch,
}: {
  allTasks: OnboardingTask[];
  completeTasks: OnboardingTask[];
  doneTasks: OnboardingTask[];
  isActive: boolean;
  refetch: () => void;
}) {
  const theme = useTheme();
  const {layout} = useNavContext();
  const isMobile = layout === NavLayout.MOBILE;
  const showLabel = isMobile;
  const demoMode = isDemoModeActive();
  const label = demoMode ? t('Guided Tours') : t('Onboarding');
  const pendingCompletionSeen = doneTasks.length !== completeTasks.length;
  const {activateSidebar} = useOnboardingSidebar();

  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = usePrimaryButtonOverlay({
    isOpen: isActive,
    onOpenChange: newIsOpen => {
      if (newIsOpen) {
        activateSidebar({
          recordAnalytics: !demoMode && !isActive,
          userClicked: true,
          source: 'onboarding_sidebar',
        });
      } else {
        SidebarPanelStore.hidePanel();
      }
    },
  });

  return (
    <GuideAnchor target="onboarding_sidebar" position="right">
      <SidebarItem label={label} showLabel={showLabel}>
        <NavButton
          {...overlayTriggerProps}
          isMobile={isMobile}
          aria-label={showLabel ? undefined : label}
          onMouseEnter={() => {
            refetch();
          }}
        >
          <InteractionStateLayer />
          <ProgressRingWrapper isMobile={isMobile}>
            <OnboardingProgressRing
              isMobile={isMobile}
              animate
              textCss={() => css`
                font-size: ${isMobile ? theme.fontSizeExtraSmall : theme.fontSizeSmall};
                font-weight: ${theme.fontWeightBold};
                color: ${theme.purple400};
              `}
              text={
                doneTasks.length === allTasks.length ? (
                  <IconCheckmark />
                ) : (
                  doneTasks.length
                )
              }
              value={(doneTasks.length / allTasks.length) * 100}
              backgroundColor={theme.gray200}
              progressEndcaps="round"
              progressColor={theme.purple400}
              size={isMobile ? 22 : 26}
              barWidth={4}
            />
          </ProgressRingWrapper>
          {showLabel ? label : null}
          {pendingCompletionSeen && (
            <SidebarItemUnreadIndicator data-test-id="pending-seen-indicator" />
          )}
        </NavButton>
      </SidebarItem>
      {isOpen && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          <OnboardingSidebarContent onClose={() => SidebarPanelStore.hidePanel()} />
        </PrimaryButtonOverlay>
      )}
    </GuideAnchor>
  );
}

export function PrimaryNavigationOnboarding() {
  const currentPanel = useLegacyStore(SidebarPanelStore);
  const isActive = currentPanel === SidebarPanelKey.ONBOARDING_WIZARD;
  const user = useUser();
  const {mutate: mutateUserOptions} = useMutateUserOptions();
  const {activateSidebar} = useOnboardingSidebar();
  const organization = useOrganization();
  const [quickStartCompleted, setQuickStartCompleted] = useLocalStorageState(
    `quick-start:${organization.slug}:completed`,
    false
  );

  const demoMode = isDemoModeActive();

  const {allTasks, doneTasks, completeTasks, refetch} = useOnboardingTasks({
    disabled: !isActive,
  });

  const allTasksCompleted = allTasks.length === completeTasks.length;

  const skipQuickStart =
    (!demoMode && !organization.features?.includes('onboarding')) ||
    (allTasksCompleted && !isActive);

  const orgId = organization.id;

  const quickStartDisplay = useMemo(() => {
    return user?.options?.quickStartDisplay ?? {};
  }, [user?.options?.quickStartDisplay]);

  const quickStartDisplayStatus = quickStartDisplay[orgId] ?? 0;

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
      activateSidebar({
        userClicked: false,
        source: 'onboarding_sidebar_user_second_visit',
      });
    }
    // be careful when adding dependencies here as it can cause side-effects, e.g activateSidebar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutateUserOptions, orgId, skipQuickStart]);

  if (skipQuickStart) {
    return null;
  }

  return (
    <OnboardingItem
      allTasks={allTasks}
      doneTasks={doneTasks}
      completeTasks={completeTasks}
      isActive={isActive}
      refetch={refetch}
    />
  );
}

// This wrapper matches the size of other nav button icons. This is ncessary
// because the progress ring is larger than the icons, but we want this
// to be sized similarly to other nav buttons.
const ProgressRingWrapper = styled('div')<{isMobile: boolean}>`
  height: ${p => (p.isMobile ? '14px' : '16px')};
  width: ${p => (p.isMobile ? '14px' : '16px')};
  position: relative;
`;

const OnboardingProgressRing = styled(ProgressRing)<{isMobile: boolean}>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;
