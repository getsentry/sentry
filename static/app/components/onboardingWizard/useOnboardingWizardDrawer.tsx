import {useEffect} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {OnboardingSidebarContent} from 'sentry/components/onboardingWizard/content';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

export function useOnboardingWizardDrawer() {
  const currentPanel = useLegacyStore(SidebarPanelStore);
  const isActive = currentPanel === SidebarPanelKey.ONBOARDING_WIZARD;

  const {openDrawer} = useDrawer();

  useEffect(() => {
    if (isActive) {
      openDrawer(({closeDrawer}) => <OnboardingSidebarContent onClose={closeDrawer} />, {
        ariaLabel: t('Onboarding'),
      });

      // Reset store state
      SidebarPanelStore.hidePanel();
    }
  }, [isActive, openDrawer]);
}
