import {useEffect} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {GuideAnchor} from 'sentry/components/assistant/guideAnchor';
import {OnboardingSidebarContent} from 'sentry/components/onboardingWizard/content';
import {useOnboardingTasks} from 'sentry/components/onboardingWizard/useOnboardingTasks';
import {ProgressRing} from 'sentry/components/progressRing';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {t} from 'sentry/locale';
import OnboardingDrawerStore, {
  OnboardingDrawerKey,
} from 'sentry/stores/onboardingDrawerStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {OnboardingTask} from 'sentry/types/onboarding';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import {useNavigationContext} from 'sentry/views/navigation/navigationContext';
import {
  SidebarButton,
  SidebarItemUnreadIndicator,
} from 'sentry/views/navigation/primary/components';
import {
  PrimaryButtonOverlay,
  usePrimaryButtonOverlay,
} from 'sentry/views/navigation/primary/primaryButtonOverlay';
import {NavigationLayout} from 'sentry/views/navigation/types';
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
  const {layout} = useNavigationContext();
  const isMobile = layout === NavigationLayout.MOBILE;
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
        OnboardingDrawerStore.close();
      }
    },
  });

  return (
    <GuideAnchor target="onboarding_sidebar" position="right">
      <SidebarButton
        analyticsKey="onboarding"
        buttonProps={{
          ...overlayTriggerProps,
          onMouseEnter: refetch,
          size: isMobile ? 'xs' : 'sm',
          icon: (
            <ProgressRingWrapper isMobile={isMobile}>
              <OnboardingProgressRing
                isMobile={isMobile}
                animate
                textCss={() => css`
                  font-size: ${theme.font.size.sm};
                  font-weight: ${theme.font.weight.sans.medium};
                  color: ${theme.tokens.content.accent};
                  ${isMobile && 'display: none'};
                `}
                text={
                  doneTasks.length === allTasks.length ? (
                    <IconCheckmark size="xs" />
                  ) : (
                    doneTasks.length
                  )
                }
                value={(doneTasks.length / allTasks.length) * 100}
                backgroundColor={theme.colors.gray200}
                progressEndcaps="round"
                progressColor={theme.tokens.content.accent}
                size={isMobile ? 14 : 18}
                barWidth={isMobile ? 2 : 2}
              />
            </ProgressRingWrapper>
          ),
        }}
        label={label}
      >
        {pendingCompletionSeen && (
          <SidebarItemUnreadIndicator
            data-test-id="pending-seen-indicator"
            isMobile={isMobile}
          />
        )}
      </SidebarButton>
      {isOpen && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          <OnboardingSidebarContent onClose={OnboardingDrawerStore.close} />
        </PrimaryButtonOverlay>
      )}
    </GuideAnchor>
  );
}

export function PrimaryNavigationOnboarding() {
  const currentPanel = useLegacyStore(OnboardingDrawerStore);
  const isActive = currentPanel === OnboardingDrawerKey.ONBOARDING_WIZARD;
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
  height: ${p => (p.isMobile ? '14px' : '12px')};
  width: ${p => (p.isMobile ? '14px' : '12px')};
  position: relative;
`;

const OnboardingProgressRing = styled(ProgressRing)<{isMobile: boolean}>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;
