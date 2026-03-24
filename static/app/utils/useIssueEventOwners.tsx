import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {EventOwners} from 'sentry/views/issueDetails/streamline/header/getOwnerList';

interface UseIssueEventOwnersProps {
  eventId: string;
  projectSlug: string;
}

const makeCommittersQueryKey = (
  orgSlug: string,
  projectSlug: string,
  eventId: string
): ApiQueryKey => [
  getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/owners/', {
    path: {
      organizationIdOrSlug: orgSlug,
      projectIdOrSlug: projectSlug,
      eventId,
    },
  }),
];

export function useIssueEventOwners(
  {eventId, projectSlug}: UseIssueEventOwnersProps,
  options: Partial<UseApiQueryOptions<EventOwners>> = {}
) {
  const org = useOrganization();
  return useApiQuery<EventOwners>(
    makeCommittersQueryKey(org.slug, projectSlug, eventId),
    {
      staleTime: Infinity,
      retry: false,
      enabled: !!eventId,
      ...options,
    }
  );
}
