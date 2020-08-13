import {LocationDescriptor, Query} from 'history';

import {OrganizationSummary} from 'app/types';

export function getPerformanceLandingUrl(organization: OrganizationSummary): string {
  return `/organizations/${organization.slug}/performance/`;
}

export function getTransactionDetailsUrl(
  organization: OrganizationSummary,
  eventSlug: string,
  transaction: string,
  query: Query
): LocationDescriptor {
  return {
    pathname: `/organizations/${organization.slug}/performance/${eventSlug}/`,
    query: {
      ...query,
      transaction,
    },
  };
}

export function getTransactionComparisonUrl({
  organization,
  baselineEventSlug,
  regressionEventSlug,
  transaction,
  query,
}: {
  organization: OrganizationSummary;
  baselineEventSlug: string;
  regressionEventSlug: string;
  transaction: string;
  query: Query;
}): LocationDescriptor {
  return {
    pathname: `/organizations/${organization.slug}/performance/compare/${baselineEventSlug}/${regressionEventSlug}/`,
    query: {
      ...query,
      transaction,
    },
  };
}
