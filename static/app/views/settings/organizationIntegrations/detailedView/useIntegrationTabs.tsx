import {useEffect, useState} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import type {IntegrationTab} from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';

/**
 * This hook implemented a function from the deprecated AbstractIntegrationDetailedView.
 * On mount, this will alter the active tab based on the query param.
 *
 * XXX: It doesn't change the query param when a tab is changed, so it's probably here to preserve
 * some existing external links living outside Sentry.
 */
export function useIntegrationTabs<T extends IntegrationTab>({
  initialTab = 'overview' as T,
}: {
  initialTab: T;
}) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<T>(initialTab);
  useEffect(() => {
    if (location.query.tab) {
      setActiveTab(location.query.tab as T);
    }
  }, [location.query.tab]);
  return {activeTab, setActiveTab};
}
