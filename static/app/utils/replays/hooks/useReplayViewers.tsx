import {skipToken, useQuery} from '@tanstack/react-query';

import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

interface ViewedByResponse {
  data: {viewed_by: User[]};
}

/**
 * The people who have watched a replay.
 */
export function useReplayViewers({
  projectId,
  replayId,
}: {
  projectId: string | undefined;
  replayId: string | undefined;
}) {
  const organization = useOrganization();

  const canFetch = Boolean(projectId && replayId);

  const {data, isPending, isError} = useQuery(
    apiOptions.as<ViewedByResponse>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/viewed-by/',
      {
        path: canFetch
          ? {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: projectId!,
              replayId: replayId!,
            }
          : skipToken,
        staleTime: 0,
      }
    )
  );

  return {
    users: data?.data.viewed_by ?? [],
    isPending: canFetch && isPending && !isError,
  };
}
