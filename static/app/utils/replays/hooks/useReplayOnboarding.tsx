import {useCallback, useEffect} from 'react';

import OnboardingDrawerStore, {
  OnboardingDrawerKey,
} from 'sentry/stores/onboardingDrawerStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import useSelectedProjectsHaveField from 'sentry/utils/project/useSelectedProjectsHaveField';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

export function useHaveSelectedProjectsSentAnyReplayEvents() {
  const {hasField: hasSentOneReplay, fetching} =
    useSelectedProjectsHaveField('hasReplays');
  return {hasSentOneReplay, fetching};
}

export function useReplayOnboardingSidebarPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

  useEffect(() => {
    if (location.hash === '#replay-sidequest') {
      OnboardingDrawerStore.open(OnboardingDrawerKey.REPLAYS_ONBOARDING);
      trackAnalytics('replay.list-view-setup-sidebar', {
        organization,
      });
    }
  }, [location.hash, organization]);

  const activateSidebar = useCallback(
    (projectId?: string) => {
      navigate({
        ...location,
        hash: 'replay-sidequest',
        query: projectId
          ? {
              ...location.query,
              project: projectId,
            }
          : location.query,
      });
      OnboardingDrawerStore.open(OnboardingDrawerKey.REPLAYS_ONBOARDING);
    },
    [location, navigate]
  );

  return {activateSidebar};
}
