import type {Committer} from 'sentry/types';
import {QueryKey, useApiQuery, UseQueryOptions} from 'sentry/utils/queryClient';

import useOrganization from './useOrganization';

interface UseCommittersProps {
  eventId: string;
  projectSlug: string;
}

interface CommittersResponse {
  committers: Committer[];
}

const makeCommittersQueryKey = (
  orgSlug: string,
  projectSlug: string,
  eventId: string
): QueryKey => [`/projects/${orgSlug}/${projectSlug}/events/${eventId}/committers/`];

function useCommitters(
  {eventId, projectSlug}: UseCommittersProps,
  options: Partial<UseQueryOptions<CommittersResponse>> = {}
) {
  const org = useOrganization();
  return useApiQuery<CommittersResponse>(
    makeCommittersQueryKey(org.slug, projectSlug, eventId),
    {
      staleTime: Infinity,
      retry: false,
      ...options,
    }
  );
}

export default useCommitters;
