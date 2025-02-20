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
      openDrawer(({closeDrawer}) => <DrawerContent closeDrawer={closeDrawer} />, {
        ariaLabel: t('Onboarding'),
      });
    }
  }, [isActive, openDrawer]);
}

function DrawerContent({closeDrawer}: {closeDrawer: () => void}) {
  useEffect(() => {
    return () => {
      SidebarPanelStore.hidePanel();
    };
  }, []);

  return <OnboardingSidebarContent onClose={closeDrawer} />;
}
