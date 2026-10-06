import {skipToken, useQuery} from '@tanstack/react-query';

import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

interface ViewedByResponse {
  data: {viewed_by: User[]};
}

/**
 * The people who have watched a replay.
 *
 * The endpoint is keyed by project slug, which has to be resolved from the id
 * through the projects store, so the request waits until that lands.
 */
export function useReplayViewers({
  projectId,
  replayId,
}: {
  projectId: string | undefined;
  replayId: string | undefined;
}) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const projectSlug = projects.find(p => p.id === projectId)?.slug;

  const canFetch = Boolean(projectSlug && replayId);

  const {data, isPending, isError} = useQuery(
    apiOptions.as<ViewedByResponse>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/viewed-by/',
      {
        path: canFetch
          ? {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: projectSlug!,
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
