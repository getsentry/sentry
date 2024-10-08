import type {EventOwners} from 'sentry/components/group/assignedTo';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface UseIssueEventOwnersProps {
  eventId: string;
  projectSlug: string;
}

const makeCommittersQueryKey = (
  orgSlug: string,
  projectSlug: string,
  eventId: string
): ApiQueryKey => [`/projects/${orgSlug}/${projectSlug}/events/${eventId}/owners/`];

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
