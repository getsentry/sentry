import type {Group} from 'sentry/types/group';
import type {Committer} from 'sentry/types/integrations';

import type {ApiQueryKey} from './api/apiQueryKey';
import {getApiUrl} from './api/getApiUrl';
import {useApiQuery} from './queryClient';
import {useOrganization} from './useOrganization';
import {usePrevious} from './usePrevious';

interface UseCommittersProps {
  eventId: string;
  group: Group;
  projectSlug: string;
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

export function useCommitters({eventId, projectSlug, group}: UseCommittersProps) {
  const org = useOrganization();
  const previousGroupId = usePrevious(group.id);
  return useApiQuery<CommittersResponse>(
    makeCommittersQueryKey(org.slug, projectSlug, eventId),
    {
      staleTime: Infinity,
      retry: false,
      enabled: !!eventId,
      placeholderData: previousData => {
        return group.id === previousGroupId ? previousData : undefined;
      },
    }
  );
}
