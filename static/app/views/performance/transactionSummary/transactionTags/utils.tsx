import {Location, Query} from 'history';

import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {decodeScalar} from 'app/utils/queryString';

export function generateTagsRoute({orgSlug}: {orgSlug: String}): string {
  return `/organizations/${orgSlug}/performance/summary/tags/`;
}

export function decodeSelectedTagKey(location: Location): string | undefined {
  return decodeScalar(location.query.tagKey);
}

export function trackTagPageInteraction(organization: Organization) {
  trackAnalyticsEvent({
    eventKey: 'performance_views.tags.interaction',
    eventName: 'Performance Views: Tag Page - Interaction',
    organization_id: parseInt(organization.id, 10),
  });
}

export function tagsRouteWithQuery({
  orgSlug,
  transaction,
  projectID,
  query,
}: {
  orgSlug: string;
  transaction: string;
  query: Query;
  projectID?: string | string[];
}) {
  const pathname = generateTagsRoute({
    orgSlug,
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

// TODO(k-fish): Improve meta of backend response to return these directly
export function parseHistogramBucketInfo(row: {[key: string]: React.ReactText}) {
  const field = Object.keys(row).find(f => f.includes('histogram'));
  if (!field) {
    return undefined;
  }
  const parts = field.split('_');
  return {
    histogramField: field,
    bucketSize: parseInt(parts[parts.length - 3], 10),
    offset: parseInt(parts[parts.length - 2], 10),
    multiplier: parseInt(parts[parts.length - 1], 10),
  };
}
