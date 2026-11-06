import {useQuery} from '@tanstack/react-query';

import type {Group} from 'sentry/types/group';
import type {Committer} from 'sentry/types/integrations';

import {apiOptions} from './api/apiOptions';
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

const makeCommittersApiOptions = (
  orgSlug: string,
  projectSlug: string,
  eventId: string
) =>
  apiOptions.as<CommittersResponse>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/committers/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        projectIdOrSlug: projectSlug,
        eventId,
      },
      staleTime: Infinity,
    }
  );

export function useCommitters({eventId, projectSlug, group}: UseCommittersProps) {
  const org = useOrganization();
  const previousGroupId = usePrevious(group.id);
  return useQuery({
    ...makeCommittersApiOptions(org.slug, projectSlug, eventId),

    retry: false,
    enabled: !!eventId,
    placeholderData: previousData => {
      return group.id === previousGroupId ? previousData : undefined;
    },
  });
}
