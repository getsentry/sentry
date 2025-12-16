import {useEffect} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useShowAgentOnboarding} from 'sentry/views/insights/pages/agents/hooks/useShowAgentOnboarding';

export function useAgentMonitoringTrackPageView() {
  const showOnboarding = useShowAgentOnboarding();
  const organization = useOrganization();

  useEffect(() => {
    trackAnalytics('agent-monitoring.page-view', {
      organization,
      isOnboarding: showOnboarding,
    });
  }, [organization, showOnboarding]);
}
