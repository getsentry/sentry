import {escapeDoubleQuotes} from 'sentry/utils';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

export const CLASSIFIER_PREVIEW_PER_PAGE = 10;

export function getClassifiersPath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/classifiers/`);
}

export function getClassifierDetailPath(organizationSlug: string, classifierId: string) {
  return `${getClassifiersPath(organizationSlug)}${classifierId}/`;
}

export function getNewClassifierPath(organizationSlug: string) {
  return `${getClassifiersPath(organizationSlug)}new/`;
}

export function getEnvironmentsFilter(environments: readonly string[]) {
  if (environments.length === 0) {
    return '';
  }
  const values = environments.map(value => `"${escapeDoubleQuotes(value)}"`).join(', ');
  return `environment:[${values}]`;
}

export function useClassifiersEnabled() {
  const organization = useOrganization({allowNull: true});
  return !!organization?.features.includes('classifiers-ui');
}
