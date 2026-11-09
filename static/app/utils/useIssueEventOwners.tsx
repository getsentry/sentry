import type {EventOwners} from 'sentry/views/issueDetails/header/getOwnerList';

import type {ApiQueryKey} from './api/apiQueryKey';
import {getApiUrl} from './api/getApiUrl';
import {useApiQuery} from './queryClient';
import {useOrganization} from './useOrganization';

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

export function useIssueEventOwners({eventId, projectSlug}: UseIssueEventOwnersProps) {
  const org = useOrganization();
  return useApiQuery<EventOwners>(
    makeCommittersQueryKey(org.slug, projectSlug, eventId),
    {
      staleTime: Infinity,
      retry: false,
      enabled: !!eventId,
    }
  );
}
