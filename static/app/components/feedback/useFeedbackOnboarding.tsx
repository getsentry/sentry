import {useCallback, useEffect} from 'react';

import OnboardingDrawerStore, {
  OnboardingDrawerKey,
} from 'sentry/stores/onboardingDrawerStore';
import useSelectedProjectsHaveField from 'sentry/utils/project/useSelectedProjectsHaveField';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export const CRASH_REPORT_HASH = '#crashreport-sidequest';
const FEEDBACK_HASH = '#feedback-sidequest';

export default function useHaveSelectedProjectsSetupFeedback() {
  const {hasField: hasSetupOneFeedback, fetching} =
    useSelectedProjectsHaveField('hasFeedbacks');
  return {hasSetupOneFeedback, fetching};
}

export function useFeedbackOnboardingSidebarPanel() {
  const location = useLocation();
  const organization = useOrganization();

  useEffect(() => {
    if (location.hash === FEEDBACK_HASH || location.hash === CRASH_REPORT_HASH) {
      OnboardingDrawerStore.open(OnboardingDrawerKey.FEEDBACK_ONBOARDING);
    }
  }, [location.hash, organization]);

  const activateSidebar = useCallback((event: {preventDefault: () => void}) => {
    event.preventDefault();
    window.location.hash = FEEDBACK_HASH;
    OnboardingDrawerStore.open(OnboardingDrawerKey.FEEDBACK_ONBOARDING);
  }, []);

  const activateSidebarIssueDetails = useCallback(
    (event: {preventDefault: () => void}) => {
      event.preventDefault();
      window.location.hash = CRASH_REPORT_HASH;
      OnboardingDrawerStore.open(OnboardingDrawerKey.FEEDBACK_ONBOARDING);
    },
    []
  );

  return {activateSidebar, activateSidebarIssueDetails};
}
