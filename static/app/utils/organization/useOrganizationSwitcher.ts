import {useStore} from 'zustand';

import {ConfigStore} from 'sentry/stores/configStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {localizeDomain, resolveRoute} from 'sentry/utils/resolveRoute';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useOrganizations} from 'sentry/utils/useOrganizations';

export type CreateOrganizationLink = {href: string} | {to: string};

interface OrganizationSwitcher {
  /**
   * Whether the user has another organization to switch to. Single
   * organization installs and demo mode never offer switching.
   */
  canSwitch: boolean;
  /**
   * Where to create a new organization, or `null` when the user can't, which
   * includes single organization installs and demo mode. With
   * multi-region, organizations are created on the main Sentry domain, outside
   * of any organization's customer domain, so the link is an absolute `href`.
   */
  createOrganizationLink: CreateOrganizationLink | null;
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
  const features = useStore(ConfigStore, state => state.features);
  const links = useStore(ConfigStore, state => state.links);

  const offersOtherOrganizations = !singleOrganization && !isDemoModeActive();
  const canSwitch =
    offersOtherOrganizations &&
    organizations.some(org => org.slug !== organization?.slug);

  // organizations:create is a system feature checked against the user, so it
  // is not on organization.features.
  const createOrganizationLink =
    offersOtherOrganizations && features.has('organizations:create')
      ? features.has('system:multi-region')
        ? {href: `${localizeDomain(links.sentryUrl)}/organizations/new/`}
        : {to: '/organizations/new/'}
      : null;

  const switchTo = (target: OrganizationSummary, path: string) => {
    const url = resolveRoute(path, null, target);
    if (url.startsWith('http')) {
      window.location.assign(url);
    } else {
      navigate(url);
    }
  };

  return {canSwitch, createOrganizationLink, switchTo};
}
