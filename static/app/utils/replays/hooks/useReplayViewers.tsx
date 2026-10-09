import {skipToken, useQuery} from '@tanstack/react-query';

import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useReplayProjectSlug} from 'sentry/utils/replays/hooks/useReplayProjectSlug';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import type {ReplayRecord} from 'sentry/views/explore/replays/types';

interface ViewedByResponse {
  data: {viewed_by: User[]};
}

/**
 * The people who have watched a replay.
 *
 * Keyed by project slug, which `useMarkReplayViewed` also builds its
 * invalidation URL from. Keying this on the project id instead reads the same
 * endpoint but produces a different query key, so marking the replay viewed
 * would not refresh the list.
 */
export function useReplayViewers({
  replayRecord,
}: {
  replayRecord: ReplayRecord | undefined;
}) {
  const organization = useOrganization();
  const {fetching: isFetchingProjects} = useProjects();
  const projectSlug = useReplayProjectSlug({replayRecord});

  const replayId = replayRecord?.is_archived ? undefined : replayRecord?.id;
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

  // Waiting on the store to yield the slug is still waiting. Gated on the
  // store actually fetching, so a replay whose project cannot be resolved
  // settles as empty rather than holding a skeleton forever.
  const isResolvingSlug = Boolean(replayId) && !projectSlug && isFetchingProjects;

  return {
    users: data?.data.viewed_by ?? [],
    isPending: isResolvingSlug || (canFetch && isPending && !isError),
  };
}
