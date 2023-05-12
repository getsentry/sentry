import {Location, Query} from 'history';

import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';

export function generateTagsRoute({orgSlug}: {orgSlug: string}): string {
  return `/organizations/${orgSlug}/performance/summary/tags/`;
}

export function decodeSelectedTagKey(location: Location): string | undefined {
  return decodeScalar(location.query.tagKey);
}

export function trackTagPageInteraction(organization: Organization) {
  trackAnalytics('performance_views.tags.interaction', {organization});
}

export function tagsRouteWithQuery({
  orgSlug,
  transaction,
  projectID,
  query,
}: {
  orgSlug: string;
  query: Query;
  transaction: string;
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
    bucketSize: parseInt(parts[parts.length - 3], 10),
    offset: parseInt(parts[parts.length - 2], 10),
    multiplier: parseInt(parts[parts.length - 1], 10),
  };
}
