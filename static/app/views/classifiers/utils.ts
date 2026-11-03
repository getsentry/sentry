import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

export function getClassifiersPath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/classifiers/`);
}

export function useClassifiersEnabled() {
  const organization = useOrganization();
  return organization.features.includes('classifiers-ui');
}
