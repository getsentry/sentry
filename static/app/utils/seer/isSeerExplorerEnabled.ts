import type {Organization} from 'sentry/types/organization';
import {areAiFeaturesAllowed} from 'sentry/utils/seer/areAiFeaturesAllowed';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Checks if Seer Explorer is enabled for the organization.
 * Requires the rollout flag and:
 * - AI features allowed for the organization (see areAiFeaturesAllowed)
 * - Organization has not disabled open membership
 */
export function isSeerExplorerEnabled(organization: Organization | null): boolean {
  if (!organization) {
    return false;
  }

  return (
    organization.openMembership &&
    areAiFeaturesAllowed(organization) &&
    organization.features.includes('seer-explorer')
  );
}

/**
 * Whether Seer Explorer should render as a persistent, resizable split-panel
 * sidebar instead of an overlay drawer.
 */
export function useIsSeerExplorerSidebarEnabled(): boolean {
  const organization = useOrganization({allowNull: true});
  return (
    isSeerExplorerEnabled(organization) &&
    !!organization?.features.includes('seer-explorer-persistent-sidebar')
  );
}
