import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

export function getInvestigationsPath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/investigations/`);
}

export function getInvestigationPath(organizationSlug: string, investigationId: string) {
  return normalizeUrl(
    `/organizations/${organizationSlug}/seer/investigations/${investigationId}/`
  );
}

export function useInvestigationsEnabled() {
  const organization = useOrganization({allowNull: true});
  return (
    !!organization?.openMembership && organization.features.includes('investigations')
  );
}

export function getActorName(user: {email: string; name: string}) {
  return user.name || user.email;
}
