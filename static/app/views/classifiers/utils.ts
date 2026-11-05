import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

export function getClassifiersPath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/classifiers/`);
}

export function getClassifierDetailPath(organizationSlug: string, classifierId: string) {
  return `${getClassifiersPath(organizationSlug)}${classifierId}/`;
}

export function getNewClassifierPath(organizationSlug: string) {
  return `${getClassifiersPath(organizationSlug)}new/`;
}

export function useClassifiersEnabled() {
  const organization = useOrganization();
  return organization.features.includes('classifiers-ui');
}
