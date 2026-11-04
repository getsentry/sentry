import {useMemo} from 'react';
import {useQueries} from '@tanstack/react-query';

import {DiffLineType, type FilePatch} from 'sentry/components/events/autofix/types';
import type {PullRequestFileChangeType} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {Block, RepoPRState} from 'sentry/views/seerExplorer/types';
import {parseFilePatch} from 'sentry/views/seerWorkflows/overview/filePatch';

interface PullRequestFile {
  /** Hunks only, without `---`/`+++` headers. Null for binary or very large files. */
  patch: string | null;
  path: string;
  previousPath: string | null;
  status: string;
}

interface PullRequestFilesResponse {
  files: PullRequestFile[];
}

export type PullRequestPatches =
  /** Seer has edits it hasn't pushed yet, so the PR's diff is about to change. */
  | {status: 'pushing'}
  | {status: 'pending'}
  | {status: 'error'}
  | {
      patches: FilePatch[];
      /** The last push failed, so the PR is missing Seer's latest edits. */
      pushFailed: boolean;
      status: 'success';
    };

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

/** A block's value for `key`, on the block (classic tools) or a tool result (Code Mode). */
function blockValues(block: Block, key: 'file_patches' | 'pr_commit_shas'): unknown[] {
  const values: unknown[] = [block[key]];
  for (const result of block.tool_results ?? []) {
    const structured = result?.structuredContent as Record<string, unknown> | undefined;
    values.push(structured?.[key]);
  }
  return values.filter(Boolean);
}

/** Whether the run edited `repoName` after its last push there. */
function hasUnpushedEdits(blocks: Block[], repoName: string): boolean {
  let lastPush = -1;
  let lastEdit = -1;
  blocks.forEach((block, index) => {
    for (const shas of blockValues(block, 'pr_commit_shas')) {
      if ((shas as Record<string, string>)[repoName]) {
        lastPush = index;
      }
    }
    for (const patches of blockValues(block, 'file_patches')) {
      if ((patches as Array<{repo_name: string}>).some(p => p.repo_name === repoName)) {
        lastEdit = index;
      }
    }
  });
  return lastEdit > lastPush;
}

function pickResults(
  results: Array<{data: PullRequestFilesResponse | undefined; isError: boolean}>
) {
  return results.map(({data, isError}) => ({data, isError}));
}

/**
 * Each of the run's PRs' diff on the provider, by repo name. While Seer has edits it hasn't
 * pushed, the PR's diff is about to change, so the repo is `pushing` instead.
 */
export function usePullRequestPatches({
  blocks,
  enabled,
  organizationSlug,
  repoPRStates,
}: {
  blocks: Block[];
  enabled: boolean;
  organizationSlug: string;
  repoPRStates: Record<string, RepoPRState> | undefined;
}): Map<string, PullRequestPatches> {
  const prStates = useMemo(
    () =>
      enabled ? Object.values(repoPRStates ?? {}).filter(state => state.pr_number) : [],
    [enabled, repoPRStates]
  );
  const pushing = useMemo(
    () =>
      new Set(
        prStates
          .filter(
            state =>
              state.pr_creation_status === 'creating' ||
              (state.pr_creation_status !== 'error' &&
                hasUnpushedEdits(blocks, state.repo_name))
          )
          .map(state => state.repo_name)
      ),
    [blocks, prStates]
  );

  const results = useQueries({
    queries: prStates.map(state => ({
      ...apiOptions.as<PullRequestFilesResponse>()(
        '/organizations/$organizationIdOrSlug/repos/pull-request-files/',
        {
          path: {organizationIdOrSlug: organizationSlug},
          // The endpoint ignores `commit`; it keys the query to the PR's head, so a push refetches.
          query: {
            repo: state.repo_name,
            number: state.pr_number,
            commit: state.commit_sha,
          },
          staleTime: 60_000,
        }
      ),
      enabled: !pushing.has(state.repo_name),
    })),
    combine: pickResults,
  });

  return useMemo(() => {
    const patches = new Map<string, PullRequestPatches>();
    prStates.forEach((state, index) => {
      const result = results[index];
      if (pushing.has(state.repo_name)) {
        patches.set(state.repo_name, {status: 'pushing'});
      } else if (result?.isError) {
        patches.set(state.repo_name, {status: 'error'});
      } else if (result?.data) {
        patches.set(state.repo_name, {
          status: 'success',
          pushFailed: state.pr_creation_status === 'error',
          // Binary and oversized files come back without a patch, so there is nothing to show.
          patches: result.data.files
            .map(toFilePatch)
            .filter(patch => patch.hunks.length > 0),
        });
      } else {
        patches.set(state.repo_name, {status: 'pending'});
      }
    });
    return patches;
  }, [prStates, pushing, results]);
}
