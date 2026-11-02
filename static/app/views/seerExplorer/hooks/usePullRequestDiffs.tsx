import {useCallback, useMemo} from 'react';
import {useQueries, type UseQueryResult} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {
  PullRequestDiff,
  PullRequestFile,
} from 'sentry/views/seerExplorer/runChanges';
import type {RepoPRState} from 'sentry/views/seerExplorer/types';

interface PullRequestFilesResponse {
  files: PullRequestFile[];
}

function toDiff(result: UseQueryResult<PullRequestFilesResponse>): PullRequestDiff {
  if (result.isPending) {
    return {status: 'pending'};
  }
  if (result.isError) {
    return {status: 'error'};
  }
  return {status: 'success', files: result.data.files};
}

/** The diff of each of the run's PRs, from the provider, by repo name. */
export function usePullRequestDiffs({
  enabled,
  organizationSlug,
  repoPRStates,
}: {
  enabled: boolean;
  organizationSlug: string;
  repoPRStates: Record<string, RepoPRState>;
}): Record<string, PullRequestDiff> {
  const states = useMemo(
    () => Object.values(repoPRStates).filter(state => state.pr_number),
    [repoPRStates]
  );

  const combine = useCallback(
    (results: Array<UseQueryResult<PullRequestFilesResponse>>) =>
      Object.fromEntries(
        results.map((result, index) => [states[index]!.repo_name, toDiff(result)])
      ),
    [states]
  );

  const queries = useMemo(
    () =>
      states.map(state => ({
        ...apiOptions.as<PullRequestFilesResponse>()(
          '/organizations/$organizationIdOrSlug/repos/pull-request-files/',
          {
            path: {organizationIdOrSlug: organizationSlug},
            // The endpoint ignores `commit_sha`. It keys the cache by Seer's last push, so a
            // push, even one made while this was unmounted, never shows the old diff: it lacks
            // the pushed edits, which have already left the unpushed changes.
            query: {
              repo: state.repo_name,
              number: state.pr_number,
              commit_sha: state.commit_sha ?? undefined,
            },
            staleTime: 60_000,
          }
        ),
        enabled,
      })),
    [states, organizationSlug, enabled]
  );

  return useQueries({queries, combine});
}
