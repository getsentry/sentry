import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * How often automation data refetches on its own while the tab is visible
 */
export const AUTO_REFRESH_INTERVAL = 30_000;

export function getAutomationsPath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/automations/`);
}

export function getAutomationRunsPath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/automations/runs/`);
}

export function getAutomationCreatePath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/automations/new/`);
}

export function getAutomationDetailPath(organizationSlug: string, automationId: string) {
  return normalizeUrl(
    `/organizations/${organizationSlug}/seer/automations/${encodeURIComponent(automationId)}/`
  );
}

export function useAutomationsEnabled() {
  const organization = useOrganization({allowNull: true});
  return !!organization?.features.includes('seer-automations');
}
