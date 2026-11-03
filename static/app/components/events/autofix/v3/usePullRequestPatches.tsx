import {useCallback, useMemo} from 'react';
import {skipToken, useQueries, type UseQueryResult} from '@tanstack/react-query';

import {DiffLineType, type FilePatch} from 'sentry/components/events/autofix/types';
import type {PullRequestFileChangeType} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {RepoPRState} from 'sentry/views/seerExplorer/types';
import {parseFilePatch} from 'sentry/views/seerWorkflows/overview/filePatch';

interface PullRequestFile {
  patch: string | null;
  path: string;
  previousPath: string | null;
  status: string;
}

interface PullRequestFilesResponse {
  files: PullRequestFile[];
}

type PullRequestPatches =
  | {status: 'pending'}
  | {status: 'error'}
  | {patches: FilePatch[]; status: 'success'};

const CHANGE_TYPE_BY_STATUS: Record<string, PullRequestFileChangeType> = {
  added: 'ADDED',
  removed: 'DELETED',
  renamed: 'RENAMED',
};

function toFilePatch(file: PullRequestFile): FilePatch {
  const patch = parseFilePatch({
    path: file.path,
    patch: file.patch,
    additions: 0,
    deletions: 0,
    changeType: CHANGE_TYPE_BY_STATUS[file.status] ?? 'MODIFIED',
  });
  const lines = patch.hunks.flatMap(hunk => hunk.lines);
  return {
    ...patch,
    source_file: file.previousPath ?? file.path,
    added: lines.filter(line => line.line_type === DiffLineType.ADDED).length,
    removed: lines.filter(line => line.line_type === DiffLineType.REMOVED).length,
  };
}

function toPatches(result: UseQueryResult<PullRequestFilesResponse>): PullRequestPatches {
  if (result.isPending) {
    return {status: 'pending'};
  }
  if (result.isError) {
    return {status: 'error'};
  }
  return {
    status: 'success',
    // Binary and oversized files come back without a patch, so there is nothing to show.
    patches: result.data.files.map(toFilePatch).filter(patch => patch.hunks.length > 0),
  };
}

/**
 * Each of the run's PRs' full diff, from the provider, by repo name.
 *
 * A repo stays pending while Seer pushes to its PR, so the card never shows the PR
 * without the push it is waiting on.
 */
export function usePullRequestPatches({
  enabled,
  organizationSlug,
  repoPRStates,
}: {
  enabled: boolean;
  organizationSlug: string;
  repoPRStates: Record<string, RepoPRState> | undefined;
}): Map<string, PullRequestPatches> {
  const states = useMemo(
    () =>
      enabled ? Object.values(repoPRStates ?? {}).filter(state => state.pr_number) : [],
    [enabled, repoPRStates]
  );

  const queries = useMemo(
    () =>
      states.map(state =>
        apiOptions.as<PullRequestFilesResponse>()(
          '/organizations/$organizationIdOrSlug/repos/pull-request-files/',
          {
            path:
              state.pr_creation_status === 'creating'
                ? skipToken
                : {organizationIdOrSlug: organizationSlug},
            // The endpoint ignores `commit_sha`. It keys the cache by Seer's last push,
            // so each push fetches the PR's diff again.
            query: {
              repo: state.repo_name,
              number: state.pr_number,
              commit_sha: state.commit_sha ?? undefined,
            },
            staleTime: 60_000,
          }
        )
      ),
    [states, organizationSlug]
  );

  const combine = useCallback(
    (results: Array<UseQueryResult<PullRequestFilesResponse>>) =>
      new Map(
        results.map((result, index) => [states[index]!.repo_name, toPatches(result)])
      ),
    [states]
  );

  return useQueries({queries, combine});
}
