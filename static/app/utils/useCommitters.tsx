import type {Committer} from 'sentry/types';
import {ApiQueryKey, useApiQuery, UseApiQueryOptions} from 'sentry/utils/queryClient';

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
): ApiQueryKey => [`/projects/${orgSlug}/${projectSlug}/events/${eventId}/committers/`];

function useCommitters(
  {eventId, projectSlug}: UseCommittersProps,
  options: Partial<UseApiQueryOptions<CommittersResponse>> = {}
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
