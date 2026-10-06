import {skipToken, useQuery} from '@tanstack/react-query';

import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

interface ViewedByResponse {
  data: {viewed_by: User[]};
}

/**
 * The people who have watched a replay.
 *
 * Keyed by project id rather than slug: the endpoint takes either, and the id
 * arrives with the replay record, whereas the slug needs a second hop through
 * the projects store that would delay the request further.
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
    // A skipped query stays pending forever, so an unresolvable replay would
    // otherwise sit on a skeleton. Treat it as settled-and-empty instead.
    isPending: canFetch && isPending && !isError,
  };
}
