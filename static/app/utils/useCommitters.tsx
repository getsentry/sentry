import type {Group} from 'sentry/types/group';
import type {Committer} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import usePrevious from 'sentry/utils/usePrevious';

import useOrganization from './useOrganization';

interface UseCommittersProps {
  eventId: string;
  projectSlug: string;
  group?: Group;
}

interface CommittersResponse {
  committers: Committer[];
}

const makeCommittersQueryKey = (
  orgSlug: string,
  projectSlug: string,
  eventId: string
): ApiQueryKey => [
  getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/committers/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        projectIdOrSlug: projectSlug,
        eventId,
      },
    }
  ),
];

function useCommitters(
  {eventId, projectSlug, group}: UseCommittersProps,
  options: Partial<UseApiQueryOptions<CommittersResponse>> = {}
) {
  const org = useOrganization();
  const previousGroupId = usePrevious(group?.id);
  return useApiQuery<CommittersResponse>(
    makeCommittersQueryKey(org.slug, projectSlug, eventId),
    {
      staleTime: Infinity,
      retry: false,
      enabled: !!eventId,
      placeholderData: previousData => {
        return group?.id === previousGroupId ? previousData : undefined;
      },
      ...options,
    }
  );
}

export default useCommitters;
