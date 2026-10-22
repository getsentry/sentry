import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

export function getInvestigationsPath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/investigations/`);
}

export function getInvestigationPath(organizationSlug: string, investigationId: string) {
  return normalizeUrl(
    `/organizations/${organizationSlug}/seer/investigations/${investigationId}/`
  );
}

export function isInvestigationsEnabled(organization: Organization) {
  return organization.openMembership && organization.features.includes('investigations');
}
