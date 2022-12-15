import type {Committer} from 'sentry/types';
import {QueryKey, useQuery} from 'sentry/utils/queryClient';

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

function useCommitters({eventId, projectSlug}: UseCommittersProps) {
  const org = useOrganization();
  return useQuery<CommittersResponse>(
    makeCommittersQueryKey(org.slug, projectSlug, eventId),
    {
      staleTime: 600000,
    }
  );
}

export default useCommitters;
