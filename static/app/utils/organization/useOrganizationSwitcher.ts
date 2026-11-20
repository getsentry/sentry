import {useStore} from 'zustand';

import {ConfigStore} from 'sentry/stores/configStore';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {localizeDomain} from 'sentry/utils/resolveRoute';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useOrganizations} from 'sentry/utils/useOrganizations';

type CreateOrganizationLink = {href: string} | {to: string};

interface OrganizationSwitcher {
  /**
   * Whether the user has another organization to switch to. Single
   * organization installs and demo mode never offer switching.
   */
  canSwitch: boolean;
  /**
   * Where to create a new organization, or `null` when the user can't. With
   * multi-region, organizations are created on the main Sentry domain, outside
   * of any organization's customer domain, so the link is an absolute `href`.
   */
  createOrganizationLink: CreateOrganizationLink | null;
}

export function useOrganizationSwitcher(): OrganizationSwitcher {
  const organization = useOrganization({allowNull: true});
  const organizations = useOrganizations();
  const singleOrganization = useStore(ConfigStore, state => state.singleOrganization);
  const features = useStore(ConfigStore, state => state.features);
  const links = useStore(ConfigStore, state => state.links);

  const canSwitch =
    !singleOrganization &&
    !isDemoModeActive() &&
    organizations.some(org => org.slug !== organization?.slug);

  // organizations:create is a system feature checked against the user, so it
  // is not on organization.features.
  const createOrganizationLink = features.has('organizations:create')
    ? features.has('system:multi-region')
      ? {href: `${localizeDomain(links.sentryUrl)}/organizations/new/`}
      : {to: '/organizations/new/'}
    : null;

  return {canSwitch, createOrganizationLink};
}
