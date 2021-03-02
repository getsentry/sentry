import {LocationDescriptor, Query} from 'history';

import {OrganizationSummary} from 'app/types';

export function getTraceSummaryUrl(
  organization: OrganizationSummary,
  traceSlug: string,
  query: Query
): LocationDescriptor {
  return {
    pathname: `/organizations/${organization.slug}/performance/trace/${traceSlug}/`,
    query: {...query},
  };
}
