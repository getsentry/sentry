import {t} from 'sentry/locale';
import {escapeDoubleQuotes} from 'sentry/utils';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {ClassifierDataset} from './types';

export const CLASSIFIER_PREVIEW_PER_PAGE = 10;

export const ENRICHMENT_ATTRIBUTE_PREFIX = 'sentry.enrichment.';

export function getEnrichmentAttributeName(resultAttribute: string) {
  return `${ENRICHMENT_ATTRIBUTE_PREFIX}${resultAttribute}`;
}

export function getClassifiersPath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/classifiers/`);
}

export function getClassifierDetailPath(organizationSlug: string, classifierId: string) {
  return `${getClassifiersPath(organizationSlug)}${classifierId}/`;
}

export function getNewClassifierPath(organizationSlug: string) {
  return `${getClassifiersPath(organizationSlug)}new/`;
}

export function getDatasetLabel(dataset: ClassifierDataset) {
  return dataset === 'conversation' ? t('Conversations') : t('Spans');
}

export function getResultAttributeKey(resultAttribute: string) {
  return `sentry.enrichment.${resultAttribute}`;
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
