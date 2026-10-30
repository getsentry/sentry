import {useCallback, useEffect, useMemo, useRef} from 'react';
import {useQueries, useQueryClient, type UseQueryResult} from '@tanstack/react-query';

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
            query: {repo: state.repo_name, number: state.pr_number},
            staleTime: 60_000,
          }
        ),
        enabled,
      })),
    [states, organizationSlug, enabled]
  );

  // Seer's pushes change the PR, so fetch its diff again after each one.
  const queryClient = useQueryClient();
  const pushedCommits = useRef(new Map<string, string | null>());
  useEffect(() => {
    states.forEach((state, index) => {
      const previous = pushedCommits.current.get(state.repo_name);
      if (previous !== undefined && previous !== state.commit_sha) {
        queryClient.invalidateQueries({queryKey: queries[index]!.queryKey});
      }
      pushedCommits.current.set(state.repo_name, state.commit_sha);
    });
  }, [states, queries, queryClient]);

  return useQueries({queries, combine});
}
