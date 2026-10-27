import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

export function getAutomationsPath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/automations/`);
}

export function getAutomationRunsPath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/automations/runs/`);
}

export function useAutomationsEnabled() {
  const organization = useOrganization({allowNull: true});
  return !!organization?.features.includes('seer-automations');
}
