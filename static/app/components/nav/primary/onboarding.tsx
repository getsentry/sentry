import {useCallback, useEffect, useMemo} from 'react';
import {css, useTheme} from '@emotion/react';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useNavContext} from 'sentry/components/nav/context';
import {
  NavButton,
  SidebarItem,
  SidebarItemUnreadIndicator,
} from 'sentry/components/nav/primary/components';
import {NavLayout} from 'sentry/components/nav/types';
import {useOnboardingTasks} from 'sentry/components/onboardingWizard/useOnboardingTasks';
import {useOnboardingWizardDrawer} from 'sentry/components/onboardingWizard/useOnboardingWizardDrawer';
import ProgressRing from 'sentry/components/progressRing';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useOnboardingSidebar} from 'sentry/views/onboarding/useOnboardingSidebar';

export function PrimaryNavigationOnboarding() {
  const {layout} = useNavContext();
  useOnboardingWizardDrawer();

  const currentPanel = useLegacyStore(SidebarPanelStore);
  const isActive = currentPanel === SidebarPanelKey.ONBOARDING_WIZARD;
  const user = useUser();
  const theme = useTheme();
  const {mutate: mutateUserOptions} = useMutateUserOptions();
  const {activateSidebar} = useOnboardingSidebar();
  const organization = useOrganization();
  const [quickStartCompleted, setQuickStartCompleted] = useLocalStorageState(
    `quick-start:${organization.slug}:completed`,
    false
  );

  const demoMode = isDemoModeEnabled();

  const {allTasks, doneTasks, completeTasks, refetch} = useOnboardingTasks({
    disabled: !isActive,
  });

  const label = demoMode ? t('Guided Tours') : t('Onboarding');
  const allTasksCompleted = allTasks.length === completeTasks.length;
  const pendingCompletionSeen = doneTasks.length !== completeTasks.length;
  const showLabel = layout === NavLayout.MOBILE;

  const skipQuickStart =
    (!demoMode && !organization.features?.includes('onboarding')) ||
    (allTasksCompleted && !isActive);

  const orgId = organization.id;

  const quickStartDisplay = useMemo(() => {
    return user?.options?.quickStartDisplay ?? {};
  }, [user?.options?.quickStartDisplay]);

  const quickStartDisplayStatus = quickStartDisplay[orgId] ?? 0;

  const handleShowPanel = useCallback(() => {
    if (!demoMode && !isActive) {
      trackAnalytics('quick_start.opened', {
        organization,
      });
    }

    activateSidebar();
  }, [activateSidebar, isActive, demoMode, organization]);

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
      <SidebarItem>
        <NavButton
          isMobile={layout === NavLayout.MOBILE}
          aria-label={showLabel ? undefined : label}
          onClick={handleShowPanel}
          onMouseEnter={() => {
            refetch();
          }}
        >
          <InteractionStateLayer />
          <ProgressRing
            animate
            textCss={() => css`
              font-size: ${showLabel ? theme.fontSizeSmall : theme.fontSizeMedium};
              font-weight: ${theme.fontWeightBold};
              color: ${theme.purple400};
            `}
            text={doneTasks.length}
            value={(doneTasks.length / allTasks.length) * 100}
            backgroundColor="rgba(255, 255, 255, 0.15)"
            progressEndcaps="round"
            progressColor={theme.purple400}
            size={showLabel ? 28 : 32}
            barWidth={4}
          />
          {showLabel ? label : null}
          {pendingCompletionSeen && (
            <SidebarItemUnreadIndicator data-test-id="pending-seen-indicator" />
          )}
        </NavButton>
      </SidebarItem>
    </GuideAnchor>
  );
}
