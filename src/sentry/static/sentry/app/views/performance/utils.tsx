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
