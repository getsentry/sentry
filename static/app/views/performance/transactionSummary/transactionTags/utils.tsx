import type {Location, Query} from 'history';

import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

function generateTagsRoute({
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
  const tagSort = decodeScalar(location.query?.tagSort) ?? '-frequency';

  if (tagSort.includes('sumdelta')) {
    return '-frequency';
  }

  return tagSort;
}

// TODO(k-fish): Improve meta of backend response to return these directly
export function parseHistogramBucketInfo(row: Record<string, string | number>) {
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

export function generateTransactionTagsEventView({
  location,
  transactionName,
}: {
  location: Location;
  transactionName: string;
}): EventView {
  const query = `(${decodeScalar(location.query.query, '')})`;
  const conditions = new MutableSearch(query);

  conditions.setFilterValues('event.type', ['transaction']);
  conditions.setFilterValues('transaction', [transactionName]);

  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: ['transaction.duration'],
      query: conditions.formatString(),
      projects: [],
    },
    location
  );

  return eventView;
}
