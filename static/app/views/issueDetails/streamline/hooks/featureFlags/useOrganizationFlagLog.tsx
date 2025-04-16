import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {RawFlagData} from 'sentry/views/issueDetails/streamline/featureFlagUtils';

export function useOrganizationFlagLog({
  organization,
  query,
}: {
  organization: Organization;
  query: Record<string, any>;
}) {
  // Don't make the request if start = end. The backend returns 400 but we prefer an empty response.
  const enabled = !query.start || !query.end || query.start !== query.end;

  return useApiQuery<RawFlagData>(
    [`/organizations/${organization.slug}/flags/logs/`, {query}],
    {
      staleTime: 0,
      enabled,
    }
  );
}
