import {useCallback, useEffect} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import useSelectedProjectsHaveField from 'sentry/utils/project/useSelectedProjectsHaveField';
import useOrganization from 'sentry/utils/useOrganization';
import {useRouteContext} from 'sentry/utils/useRouteContext';

export default function useHaveSelectedProjectsSetupFeedback() {
  const {hasField: hasSetupOneFeedback, fetching} =
    useSelectedProjectsHaveField('hasFeedbacks');
  return {hasSetupOneFeedback, fetching};
}

export function useHaveSelectedProjectsSetupNewFeedback() {
  const {hasField: hasSetupNewFeedback, fetching} =
    useSelectedProjectsHaveField('hasNewFeedbacks');
  return {hasSetupNewFeedback, fetching};
}

export function useFeedbackOnboardingSidebarPanel() {
  const {location} = useRouteContext();
  const organization = useOrganization();

  useEffect(() => {
    if (location.hash === '#feedback-sidequest') {
      SidebarPanelStore.activatePanel(SidebarPanelKey.FEEDBACK_ONBOARDING);
      trackAnalytics('feedback.list-view-setup-sidebar', {
        organization,
      });
    }
  }, [location.hash, organization]);

  const activateSidebar = useCallback((event: {preventDefault: () => void}) => {
    event.preventDefault();
    window.location.hash = 'feedback-sidequest';
    SidebarPanelStore.activatePanel(SidebarPanelKey.FEEDBACK_ONBOARDING);
  }, []);

  return {activateSidebar};
}
