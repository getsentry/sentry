import {useStore} from 'zustand';

import {ConfigStore} from 'sentry/stores/configStore';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {localizeDomain} from 'sentry/utils/resolveRoute';

export type CreateOrganizationLink = {href: string} | {to: string};

/**
 * Where the user can create a new organization, or `null` when they can't,
 * which includes single organization installs and demo mode. With
 * multi-region, organizations are created on the main Sentry domain, outside of
 * any organization's customer domain, so the link is an absolute `href`.
 */
export function useCreateOrganizationLink(): CreateOrganizationLink | null {
  const singleOrganization = useStore(ConfigStore, state => state.singleOrganization);
  const features = useStore(ConfigStore, state => state.features);
  const links = useStore(ConfigStore, state => state.links);

  // organizations:create is a system feature checked against the user, so it
  // is not on organization.features.
  if (singleOrganization || isDemoModeActive() || !features.has('organizations:create')) {
    return null;
  }

  return features.has('system:multi-region')
    ? {href: `${localizeDomain(links.sentryUrl)}/organizations/new/`}
    : {to: '/organizations/new/'};
}
