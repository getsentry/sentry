import {useEffect, useMemo} from 'react';
import {Location} from 'history';

import {getMergedTasks} from 'sentry/components/onboardingWizard/taskConfig';
import {isDone} from 'sentry/components/sidebar/onboardingStatus';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import ConfigStore from 'sentry/stores/configStore';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {usePersistedOnboardingState} from 'sentry/views/onboarding/utils';

export const useOpenOnboardingSidebar = (location?: Location) => {
  const [onboardingState] = usePersistedOnboardingState();
  const {projects: project} = useProjects();
  const organization = useOrganization();
  const hasOrganization = !!organization;

  const openOnboardingSidebar = useMemo(() => {
    if (location?.hash === '#welcome') {
      if (hasOrganization && !ConfigStore.get('demoMode')) {
        const tasks = getMergedTasks({
          organization,
          projects: project,
          onboardingState: onboardingState || undefined,
        });

        const allDisplayedTasks = tasks
          .filter(task => task.display)
          .filter(task => !task.renderCard);
        const doneTasks = allDisplayedTasks.filter(isDone);

        return !(doneTasks.length >= allDisplayedTasks.length);
      }
      return true;
    }
    return false;
  }, [location?.hash, hasOrganization, organization, project, onboardingState]);

  useEffect(() => {
    if (openOnboardingSidebar) {
      SidebarPanelStore.activatePanel(SidebarPanelKey.OnboardingWizard);
    }
  }, [openOnboardingSidebar]);
};
