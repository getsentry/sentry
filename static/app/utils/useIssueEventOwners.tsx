import {useQuery} from '@tanstack/react-query';

import type {EventOwners} from 'sentry/views/issueDetails/header/getOwnerList';

import {apiOptions} from './api/apiOptions';
import {useOrganization} from './useOrganization';

interface UseIssueEventOwnersProps {
  eventId: string;
  projectSlug: string;
}

const makeCommittersApiOptions = (
  orgSlug: string,
  projectSlug: string,
  eventId: string
) =>
  apiOptions.as<EventOwners>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/owners/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        projectIdOrSlug: projectSlug,
        eventId,
      },
      staleTime: Infinity,
    }
  );

export function useIssueEventOwners({eventId, projectSlug}: UseIssueEventOwnersProps) {
  const org = useOrganization();
  return useQuery({
    ...makeCommittersApiOptions(org.slug, projectSlug, eventId),

    retry: false,
    enabled: !!eventId,
  });
}
