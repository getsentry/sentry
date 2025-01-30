import type {Location, Query} from 'history';

import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

export function generateTagsRoute({
  organization,
  view,
}: {
  organization: Organization;
  view?: DomainView;
}): string {
  return `${getTransactionSummaryBaseUrl(organization, view)}/tags/`;
}

export function decodeSelectedTagKey(location: Location): string | undefined {
  return decodeScalar(location.query.tagKey);
}

export function trackTagPageInteraction(organization: Organization) {
  trackAnalytics('performance_views.tags.interaction', {organization});
}

export function tagsRouteWithQuery({
  organization,
  transaction,
  projectID,
  query,
  view,
}: {
  organization: Organization;
  query: Query;
  transaction: string;
  projectID?: string | string[];
  view?: DomainView;
}) {
  const pathname = generateTagsRoute({
    organization,
    view,
  });

  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: query.query,
      tagKey: query.tagKey,
    },
  };
}

export function getTagSortForTagsPage(location: Location) {
  // Retrieves the tag from the same query param segment explorer uses, but removes columns that aren't supported.
  let tagSort = decodeScalar(location.query?.tagSort) ?? '-frequency';

  if (['sumdelta'].find(denied => tagSort?.includes(denied))) {
    tagSort = '-frequency';
  }

  return tagSort;
}

// TODO(k-fish): Improve meta of backend response to return these directly
export function parseHistogramBucketInfo(row: {[key: string]: React.ReactText}) {
  const field = Object.keys(row).find(f => f.includes('histogram'));
  if (!field) {
    return undefined;
  }
  const parts = field.split('_');
  return {
    histogramField: field,
    bucketSize: parseInt(parts[parts.length - 3]!, 10),
    offset: parseInt(parts[parts.length - 2]!, 10),
    multiplier: parseInt(parts[parts.length - 1]!, 10),
  };
}
