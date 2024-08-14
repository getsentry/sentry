import {useCallback} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';

export function useMetricsOnboardingSidebar() {
  const activateSidebar = useCallback(() => {
    SidebarPanelStore.activatePanel(SidebarPanelKey.METRICS_ONBOARDING);
  }, []);

  return {activateSidebar};
}
