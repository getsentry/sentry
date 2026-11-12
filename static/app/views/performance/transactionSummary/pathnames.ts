import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';

export function getTransactionSummaryBaseUrl(
  organization: Organization,
  view?: DomainView,
  bare = false
) {
  // Eventually the performance landing page will be removed, so there is no need to rely on `getPerformanceBaseUrl`
  const url = view
    ? `${DOMAIN_VIEW_BASE_URL}/${view}/summary`
    : `${DOMAIN_VIEW_BASE_URL}/summary`;

  return bare ? url : normalizeUrl(`/organizations/${organization.slug}/${url}`);
}
