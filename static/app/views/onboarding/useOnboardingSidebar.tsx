import {useCallback} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';

export function useOnboardingSidebar() {
  const activateSidebar = useCallback(() => {
    // Delay activating the onboarding panel until after the sidebar closes on route change
    setTimeout(() => {
      SidebarPanelStore.activatePanel(SidebarPanelKey.ONBOARDING_WIZARD);
    }, 0);
  }, []);

  return {activateSidebar};
}
