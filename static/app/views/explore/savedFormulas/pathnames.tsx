import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

const SAVED_FORMULAS_BASE_PATHNAME = 'explore/saved-formulas';

export function makeSavedFormulasPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    `/organizations/${organization.slug}/${SAVED_FORMULAS_BASE_PATHNAME}${path}`
  );
}
