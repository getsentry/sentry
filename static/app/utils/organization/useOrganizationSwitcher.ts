import {useStore} from 'zustand';

import {ConfigStore} from 'sentry/stores/configStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {resolveRoute} from 'sentry/utils/resolveRoute';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useOrganizations} from 'sentry/utils/useOrganizations';

interface OrganizationSwitcher {
  /**
   * Whether the user has another organization to switch to. Single
   * organization installs and demo mode never offer switching.
   */
  canSwitch: boolean;
  /**
   * Opens `path` in `organization`. The organization can live on another
   * customer domain or region, which takes a full page load.
   */
  switchTo: (organization: OrganizationSummary, path: string) => void;
}

export function useOrganizationSwitcher(): OrganizationSwitcher {
  const navigate = useNavigate();
  const organization = useOrganization({allowNull: true});
  const organizations = useOrganizations();
  const singleOrganization = useStore(ConfigStore, state => state.singleOrganization);

  const canSwitch =
    !singleOrganization &&
    !isDemoModeActive() &&
    organizations.some(org => org.slug !== organization?.slug);

  const switchTo = (target: OrganizationSummary, path: string) => {
    const url = resolveRoute(path, null, target);
    if (url.startsWith('http')) {
      window.location.assign(url);
    } else {
      navigate(url);
    }
  };

  return {canSwitch, switchTo};
}
