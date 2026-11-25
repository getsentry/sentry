import {useCallback} from 'react';
import type {LocationDescriptor} from 'history';

import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {useOnboardingSidebar} from 'sentry/components/onboarding/useOnboardingSidebar';
import type {QuickStartEventParameters} from 'sentry/utils/analytics/quickStartAnalyticsEvents';
import {useNavigate} from 'sentry/utils/useNavigate';

type SidebarSource = QuickStartEventParameters['quick_start.opened']['source'];

/**
 * Leaves onboarding with Quick Start open, so the user can come back and
 * finish setup from the sidebar.
 */
export function useLeaveOnboarding() {
  const navigate = useNavigate();
  const {discardOnboardingSession} = useOnboardingContext();
  const {activateSidebar} = useOnboardingSidebar();

  return useCallback(
    ({to, sidebarSource}: {sidebarSource: SidebarSource; to: LocationDescriptor}) => {
      // Clear the staged session so the next onboarding visit starts fresh.
      discardOnboardingSession();
      activateSidebar({userClicked: false, source: sidebarSource});
      navigate(to);
    },
    [navigate, discardOnboardingSession, activateSidebar]
  );
}
