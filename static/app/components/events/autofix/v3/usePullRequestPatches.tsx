import {useEffect, useMemo, useRef, useState} from 'react';
import {useQueries} from '@tanstack/react-query';

import {DiffLineType} from 'sentry/components/events/autofix/types';
import {
  isPushingToPullRequest,
  type ExplorerAutofixState,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {PullRequestFileChangeType} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import type {ExplorerFilePatch, RepoPRState} from 'sentry/views/seerExplorer/types';
import {parseFilePatch} from 'sentry/views/seerWorkflows/overview/filePatch';
import type {
  PullRequestFileDiff,
  PullRequestFilesResponse as OverviewPullRequestFilesResponse,
} from 'sentry/views/seerWorkflows/overview/types';

interface PullRequestFilesResponse extends OverviewPullRequestFilesResponse {
  /** The commit the files were read at. Null if the provider doesn't say. */
  headSha: string | null;
}

export type PullRequestPatches =
  /** Seer has edits it hasn't pushed yet, so the PR's diff is about to change. */
  | {status: 'pushing'}
  | {status: 'pending'}
  | {prUrl: string | null; status: 'error'}
  | {
      patches: ExplorerFilePatch[];
      /** The last push failed, so the PR is missing Seer's latest edits. */
      pushFailed: boolean;
      status: 'success';
    };

/** How often to check whether the PR's diff has caught up with Seer's push. */
const DIFF_RECHECK_INTERVAL_MS = 2_000;
/** How long after seeing the push to keep waiting for that. */
const DIFF_CATCH_UP_WINDOW_MS = 30_000;

const CHANGE_TYPE_BY_STATUS: Record<string, PullRequestFileChangeType> = {
  added: 'ADDED',
  removed: 'DELETED',
  renamed: 'RENAMED',
};

function toFilePatch(file: PullRequestFileDiff, repoName: string): ExplorerFilePatch {
  const patch = parseFilePatch({
    path: file.path,
    patch: file.patch,
    additions: 0,
    deletions: 0,
    changeType: CHANGE_TYPE_BY_STATUS[file.status] ?? 'MODIFIED',
  });
  const lines = patch.hunks.flatMap(hunk => hunk.lines);
  return {
    repo_name: repoName,
    diff: [
      `--- ${file.status === 'added' ? '/dev/null' : `a/${file.previousPath ?? file.path}`}`,
      `+++ ${file.status === 'removed' ? '/dev/null' : `b/${file.path}`}`,
      file.patch,
    ].join('\n'),
    patch: {
      ...patch,
      source_file: file.previousPath ?? file.path,
      added: lines.filter(line => line.line_type === DiffLineType.ADDED).length,
      removed: lines.filter(line => line.line_type === DiffLineType.REMOVED).length,
    },
  };
}

/**
 * Whether the diff may be from before a push this page saw, because the provider hasn't
 * caught up. If the page didn't see the push, a different SHA means someone else pushed, so
 * there's nothing to wait for.
 *
 * A null SHA counts as behind too: the endpoint returns null when the head moved while it
 * read the files, which is likely while the provider catches up. A provider that never
 * says which commit it read just waits out the window.
 */
function isBehindPush(
  data: PullRequestFilesResponse | undefined,
  state: RepoPRState,
  pushesSeen: Map<string, number>
): boolean {
  const seenAt = defined(state.commit_sha) ? pushesSeen.get(state.commit_sha) : undefined;
  return (
    state.pr_creation_status === 'completed' &&
    defined(seenAt) &&
    Date.now() - seenAt < DIFF_CATCH_UP_WINDOW_MS &&
    defined(data) &&
    data.headSha !== state.commit_sha
  );
}

// `dataUpdatedAt` makes each recheck recompute `isBehindPush`, even if the diff is unchanged.
function pickResults(
  results: Array<{
    data: PullRequestFilesResponse | undefined;
    dataUpdatedAt: number;
    isError: boolean;
  }>
) {
  return results.map(({data, dataUpdatedAt, isError}) => ({
    data,
    dataUpdatedAt,
    isError,
  }));
}

/**
 * Each of the run's PRs' diff on the provider, by repo name. While Seer has edits it hasn't
 * pushed, the PR's diff is about to change, so the repo is `pushing` instead.
 */
export function usePullRequestPatches({
  enabled,
  organizationSlug,
  runState,
}: {
  enabled: boolean;
  organizationSlug: string;
  runState: ExplorerAutofixState | null | undefined;
}): Map<string, PullRequestPatches> {
  const repoPRStates = runState?.repo_pr_states;

  // When this page saw each of Seer's pushes, by SHA and on this page's own clock. A SHA that
  // was already there when the page loaded isn't included.
  const lastShas = useRef(new Map<string, string | null>());
  const [pushesSeen, setPushesSeen] = useState(() => new Map<string, number>());
  useEffect(() => {
    for (const {repo_name, commit_sha} of Object.values(repoPRStates ?? {})) {
      const lastSha = lastShas.current.get(repo_name);
      if (commit_sha && lastSha !== undefined && commit_sha !== lastSha) {
        setPushesSeen(seen => new Map(seen).set(commit_sha, Date.now()));
      }
      lastShas.current.set(repo_name, commit_sha);
    }
  }, [repoPRStates]);

  const prStates = useMemo(
    () =>
      enabled ? Object.values(repoPRStates ?? {}).filter(state => state.pr_number) : [],
    [enabled, repoPRStates]
  );
  const pushing = useMemo(
    () =>
      new Set(
        prStates
          .filter(state => isPushingToPullRequest(state, runState))
          .map(state => state.repo_name)
      ),
    [prStates, runState]
  );

  const results = useQueries({
    queries: prStates.map(state => {
      const options = apiOptions.as<PullRequestFilesResponse>()(
        '/organizations/$organizationIdOrSlug/repos/pull-request-files/',
        {
          path: {organizationIdOrSlug: organizationSlug},
          query: {repo: state.repo_name, number: state.pr_number},
          staleTime: Infinity,
        }
      );
      return {
        ...options,
        // The endpoint returns the PR's current diff. The SHA of Seer's last push only keys
        // the cache, so that push refetches. Other pushes show up after reloading the page.
        queryKey: [...options.queryKey, state.commit_sha] as never,
        enabled: !pushing.has(state.repo_name),
        // The provider can still return the old diff just after a push. Check again only
        // until it catches up.
        refetchInterval: (query: {state: {data?: {json: PullRequestFilesResponse}}}) =>
          isBehindPush(query.state.data?.json, state, pushesSeen)
            ? DIFF_RECHECK_INTERVAL_MS
            : false,
      };
    }),
    combine: pickResults,
  });

  return useMemo(() => {
    const patches = new Map<string, PullRequestPatches>();
    prStates.forEach((state, index) => {
      const result = results[index];
      if (pushing.has(state.repo_name)) {
        patches.set(state.repo_name, {status: 'pushing'});
      } else if (
        result?.data &&
        // If a recheck fails, show the diff we have rather than an error.
        (result.isError || !isBehindPush(result.data, state, pushesSeen))
      ) {
        patches.set(state.repo_name, {
          status: 'success',
          pushFailed: state.pr_creation_status === 'error',
          // Binary and oversized files come back without a patch, so there is nothing to show.
          patches: result.data.files
            .map(file => toFilePatch(file, state.repo_name))
            .filter(file => file.patch.hunks.length > 0),
        });
      } else if (result?.isError) {
        patches.set(state.repo_name, {status: 'error', prUrl: state.pr_url});
      } else {
        patches.set(state.repo_name, {status: 'pending'});
      }
    });
    return patches;
  }, [prStates, pushesSeen, pushing, results]);
}
