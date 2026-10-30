import {diffArrays} from 'diff';

import {
  DiffFileType,
  DiffLineType,
  type DiffLine,
  type FilePatch,
} from 'sentry/components/events/autofix/types';
import type {PullRequestFileChangeType} from 'sentry/types/integrations';
import {
  isExplorerFilePatch,
  type Block,
  type ExplorerFilePatch,
  type RepoPRState,
} from 'sentry/views/seerExplorer/types';
import {parseFilePatch} from 'sentry/views/seerWorkflows/overview/filePatch';

/** Matches Seer's `PATCH_CUTOFF_METADATA_KEY`: repos whose earlier patches a re-pin superseded. */
const PATCH_CUTOFF_METADATA_KEY = 'patch_cutoff';
const CONTEXT_LINES = 3;

export interface ChangeSet {
  added: number;
  /** One patch per file, except while Seer is still merging a block's edits. Sorted by path. */
  files: ExplorerFilePatch[];
  removed: number;
}

/** A file a PR changes, as `/repos/pull-request-files/` returns it from the provider. */
export interface PullRequestFile {
  /** Hunks only, without `---`/`+++` headers. Null for binary or very large files. */
  patch: string | null;
  path: string;
  previousPath: string | null;
  status: string;
}

export type PullRequestDiff =
  | {status: 'pending'}
  | {status: 'error'}
  | {files: PullRequestFile[]; status: 'success'};

export interface RepoChanges {
  /**
   * The PR's diff with the unpushed changes on top. Without a PR, everything the run changed.
   * Null until the PR's diff loads, or if it can't.
   */
  all: ChangeSet | null;
  /** Where loading the PR's diff stands. Without a PR there's nothing to load. */
  allStatus: 'pending' | 'error' | 'success';
  /** The run's PR for this repo, if it has one. */
  prState: RepoPRState | null;
  repoName: string;
  /** The changes since the last push, from what that push sent to the current content. */
  unpushed: ChangeSet;
}

/**
 * The run's file changes per repo: the PR's diff with the unpushed changes on top of it, and the
 * unpushed changes alone.
 *
 * The unpushed part mirrors Seer's `get_diffs_since_last_push`: a push marks `pr_commit_shas` on
 * the last block whose patches it carried, so every incremental patch after that block is what the
 * next push would commit. A re-pin to the PR head (`patch_cutoff`) measures edits from the new
 * head, so patches before it never count.
 */
export function getRunChanges(
  blocks: Block[],
  repoPRStates: Record<string, RepoPRState>,
  prDiffs: Record<string, PullRequestDiff>
): RepoChanges[] {
  const cutoffs = getPatchCutoffs(blocks);
  const incremental = collectIncrementalPatches(blocks);
  const repoNames = new Set([
    ...Object.values(repoPRStates)
      .filter(state => state.pr_number)
      .map(state => state.repo_name),
    ...incremental.map(entry => entry.patch.repo_name),
  ]);

  const changes: RepoChanges[] = [];
  for (const repoName of repoNames) {
    const cutoff = cutoffs.get(repoName.toLowerCase()) ?? -1;
    const lastPush = findLastPush(blocks, repoName);
    const since = Math.max(cutoff, lastPush);
    const unpushedEdits = incremental.filter(
      entry => entry.patch.repo_name === repoName && entry.index > since
    );

    const unpushed = toChangeSet(
      uniquePaths(unpushedEdits).flatMap(path => {
        const merged = findMergedPatches(blocks, repoName, path, cutoff);
        const now = merged.findLast(entry => entry.index > since);
        const lastEdit = unpushedEdits.findLast(entry => entry.patch.patch.path === path);
        // Seer merges a block's patches once its tool calls finish, so until then show the
        // edits themselves.
        if (!now || (lastEdit && lastEdit.index > now.index)) {
          return unpushedEdits
            .filter(entry => entry.patch.patch.path === path)
            .map(entry => entry.patch);
        }
        const pushed = merged.findLast(entry => entry.index <= lastPush);
        const patch = pushed
          ? diffPatches(pushed.patch.patch, now.patch.patch)
          : now.patch.patch;
        if (!patch) {
          return [];
        }
        return [{...now.patch, patch, diff: ''}];
      })
    );

    const prState = repoPRStates[repoName] ?? null;
    const prDiff: PullRequestDiff | null = prState?.pr_number
      ? (prDiffs[repoName] ?? {status: 'pending'})
      : null;
    if (!prDiff && unpushed.files.length === 0) {
      continue;
    }
    changes.push({
      repoName,
      prState,
      // Without a PR, every change is unpushed.
      all: prDiff
        ? prDiff.status === 'success'
          ? applyOnPullRequest(repoName, prDiff.files, unpushed)
          : null
        : unpushed,
      allStatus: prDiff?.status ?? 'success',
      unpushed,
    });
  }
  return changes;
}

const CHANGE_TYPES: Record<string, PullRequestFileChangeType> = {
  added: 'ADDED',
  removed: 'DELETED',
  renamed: 'RENAMED',
  copied: 'COPIED',
};

/** The PR's files with the unpushed changes applied on top of them. */
function applyOnPullRequest(
  repoName: string,
  prFiles: PullRequestFile[],
  unpushed: ChangeSet
): ChangeSet {
  const prPatches = new Map(
    prFiles.map(file => {
      const lines = file.patch?.split('\n') ?? [];
      const patch = parseFilePatch({
        path: file.path,
        patch: file.patch,
        additions: lines.filter(line => line.startsWith('+')).length,
        deletions: lines.filter(line => line.startsWith('-')).length,
        changeType: CHANGE_TYPES[file.status] ?? 'MODIFIED',
      });
      return [file.path, patch];
    })
  );
  const paths = new Set([...prPatches.keys(), ...unpushed.files.map(f => f.patch.path)]);

  return toChangeSet(
    [...paths].flatMap(path => {
      const edits = unpushed.files.filter(file => file.patch.path === path);
      // Unpushed edits are measured from the PR head, so they apply on top of the PR's change.
      let patch: FilePatch | null = prPatches.get(path) ?? null;
      for (const edit of edits) {
        patch = patch ? composePatches(patch, edit.patch) : edit.patch;
      }
      if (!patch) {
        return [];
      }
      return [
        {repo_name: repoName, patch, diff: '', code_url: edits.at(-1)?.code_url ?? null},
      ];
    })
  );
}

function uniquePaths(entries: IndexedPatch[]) {
  return [...new Set(entries.map(entry => entry.patch.patch.path))];
}

function toChangeSet(unsorted: ExplorerFilePatch[]): ChangeSet {
  // Stable, so a file's unmerged edits keep their order.
  const files = unsorted.toSorted((a, b) => a.patch.path.localeCompare(b.patch.path));
  return {
    files,
    added: files.reduce((sum, file) => sum + file.patch.added, 0),
    removed: files.reduce((sum, file) => sum + file.patch.removed, 0),
  };
}

interface IndexedPatch {
  index: number;
  patch: ExplorerFilePatch;
}

function getStructuredValues(block: Block, key: string): unknown[] {
  return (block.tool_results ?? []).flatMap(result => {
    const structured = result?.structuredContent as Record<string, unknown> | null;
    return structured && key in structured ? [structured[key]] : [];
  });
}

/** Classic tools write `file_patches` on the block; Code Mode returns them on its tool result. */
function collectIncrementalPatches(blocks: Block[]): IndexedPatch[] {
  return blocks.flatMap((block, index) =>
    [block.file_patches ?? [], ...getStructuredValues(block, 'file_patches')]
      .flatMap(value => (Array.isArray(value) ? value : []))
      .filter(isExplorerFilePatch)
      .map(patch => ({index, patch}))
  );
}

function findLastPush(blocks: Block[], repoName: string): number {
  return blocks.findLastIndex(block =>
    [block.pr_commit_shas, ...getStructuredValues(block, 'pr_commit_shas')].some(
      shas =>
        typeof shas === 'object' &&
        shas !== null &&
        typeof (shas as Record<string, unknown>)[repoName] === 'string'
    )
  );
}

function getPatchCutoffs(blocks: Block[]): Map<string, number> {
  const cutoffs = new Map<string, number>();
  blocks.forEach((block, index) => {
    const raw = block.message.metadata?.[PATCH_CUTOFF_METADATA_KEY];
    if (!raw) {
      return;
    }
    let repoNames: unknown;
    try {
      repoNames = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(repoNames)) {
      return;
    }
    for (const repoName of repoNames) {
      if (typeof repoName === 'string') {
        cutoffs.set(repoName.toLowerCase(), index);
      }
    }
  });
  return cutoffs;
}

function findMergedPatches(
  blocks: Block[],
  repoName: string,
  path: string,
  cutoff: number
): IndexedPatch[] {
  return blocks.flatMap((block, index) =>
    index > cutoff
      ? (block.merged_file_patches ?? [])
          .filter(patch => patch.repo_name === repoName && patch.patch.path === path)
          .map(patch => ({index, patch}))
      : []
  );
}

type Line = string | {base: number};

function stripNewline(value: string) {
  return value.endsWith('\n') ? value.slice(0, -1) : value;
}

/**
 * The diff between two patches of the same file against the same base, or null if they match.
 *
 * Seer's merged patches each go from the run's base to the file at one point in the run, so the
 * base lines either one leaves out are the same in both. Rebuilding both versions with those lines
 * as placeholders lines them up, and diffing the two gives what changed between those points.
 */
export function diffPatches(from: FilePatch, to: FilePatch): FilePatch | null {
  const base = new Map<number, string>();
  let baseLength = 0;
  for (const hunk of [...from.hunks, ...to.hunks]) {
    for (const line of hunk.lines) {
      if (line.line_type !== DiffLineType.ADDED && line.source_line_no !== null) {
        base.set(line.source_line_no, stripNewline(line.value));
        baseLength = Math.max(baseLength, line.source_line_no);
      }
    }
  }

  return patchBetween(
    to.path,
    from.type === DiffFileType.DELETED ? null : rebuild(from, base, baseLength),
    to.type === DiffFileType.DELETED ? null : rebuild(to, base, baseLength)
  );
}

/**
 * One patch for the file from before `first` to after `second`, where `second` applies on top of
 * `first`, like a PR's diff and edits made on its head.
 *
 * The lines between the two are known where either patch shows them. The rest are the same at
 * every step, so rebuilding the file before `first` and after `second` with those lines as
 * placeholders lines them up.
 */
export function composePatches(first: FilePatch, second: FilePatch): FilePatch | null {
  const middle = new Map<number, string>();
  let middleLength = 0;
  const addMiddleLine = (lineNo: number | null, value: string) => {
    if (lineNo !== null) {
      middle.set(lineNo, stripNewline(value));
      middleLength = Math.max(middleLength, lineNo);
    }
  };
  for (const line of first.hunks.flatMap(hunk => hunk.lines)) {
    if (line.line_type !== DiffLineType.REMOVED) {
      addMiddleLine(line.target_line_no, line.value);
    }
  }
  for (const line of second.hunks.flatMap(hunk => hunk.lines)) {
    if (line.line_type !== DiffLineType.ADDED) {
      addMiddleLine(line.source_line_no, line.value);
    }
  }

  return patchBetween(
    second.path,
    first.type === DiffFileType.ADDED
      ? null
      : rebuild(reversePatch(first), middle, middleLength),
    second.type === DiffFileType.DELETED ? null : rebuild(second, middle, middleLength)
  );
}

/** The patch that undoes `patch`. */
function reversePatch(patch: FilePatch): FilePatch {
  const reverseType = (type: DiffLineType) =>
    type === DiffLineType.ADDED
      ? DiffLineType.REMOVED
      : type === DiffLineType.REMOVED
        ? DiffLineType.ADDED
        : type;
  return {
    ...patch,
    hunks: patch.hunks.map(hunk => ({
      ...hunk,
      source_start: hunk.target_start,
      source_length: hunk.target_length,
      target_start: hunk.source_start,
      target_length: hunk.source_length,
      lines: hunk.lines.map(line => ({
        ...line,
        line_type: reverseType(line.line_type),
        source_line_no: line.target_line_no,
        target_line_no: line.source_line_no,
      })),
    })),
  };
}

/** The patch from `before` to `after`, where null means the file doesn't exist. */
function patchBetween(
  path: string,
  before: Line[] | null,
  after: Line[] | null
): FilePatch | null {
  if (!before && !after) {
    return null;
  }
  const hunks = buildHunks(before ?? [], after ?? []);
  if (hunks.length === 0) {
    return null;
  }
  const lines = hunks.flatMap(hunk => hunk.lines);
  return {
    path,
    source_file: before ? path : '/dev/null',
    target_file: after ? path : '/dev/null',
    type: before
      ? after
        ? DiffFileType.MODIFIED
        : DiffFileType.DELETED
      : DiffFileType.ADDED,
    added: lines.filter(line => line.line_type === DiffLineType.ADDED).length,
    removed: lines.filter(line => line.line_type === DiffLineType.REMOVED).length,
    hunks,
  };
}

/** The file as `patch` leaves it, with each base line the patch doesn't show as a placeholder. */
function rebuild(
  patch: FilePatch,
  base: Map<number, string>,
  baseLength: number
): Line[] {
  const lines: Line[] = [];
  let next = 1;
  const emitBaseUntil = (end: number) => {
    for (; next < end; next++) {
      lines.push(base.get(next) ?? {base: next});
    }
  };
  for (const hunk of [...patch.hunks].sort((a, b) => a.source_start - b.source_start)) {
    const sourceLines = hunk.lines
      .map(line => line.source_line_no)
      .filter((lineNo): lineNo is number => lineNo !== null);
    // A hunk with no source lines inserts after `source_start` (`@@ -5,0 +6,2 @@`).
    const start = sourceLines.length ? Math.min(...sourceLines) : hunk.source_start + 1;
    emitBaseUntil(start);
    for (const line of hunk.lines) {
      if (line.line_type !== DiffLineType.REMOVED) {
        lines.push(stripNewline(line.value));
      }
    }
    next = sourceLines.length ? Math.max(...sourceLines) + 1 : start;
  }
  emitBaseUntil(baseLength + 1);
  return lines;
}

function isSameLine(a: Line, b: Line) {
  return typeof a === 'string' ? a === b : typeof b !== 'string' && a.base === b.base;
}

function buildHunks(fromLines: Line[], toLines: Line[]): FilePatch['hunks'] {
  const ops: Array<{
    before: {source: number; target: number};
    line: Line;
    type: DiffLineType;
  }> = [];
  let source = 0;
  let target = 0;
  for (const change of diffArrays(fromLines, toLines, {comparator: isSameLine})) {
    const type = change.added
      ? DiffLineType.ADDED
      : change.removed
        ? DiffLineType.REMOVED
        : DiffLineType.CONTEXT;
    for (const line of change.value) {
      ops.push({before: {source, target}, line, type});
      source += type === DiffLineType.ADDED ? 0 : 1;
      target += type === DiffLineType.REMOVED ? 0 : 1;
    }
  }

  const isChange = (i: number) => ops[i]!.type !== DiffLineType.CONTEXT;
  // Placeholders stand for lines neither patch showed, so they can't be shown as context.
  const isShowableContext = (i: number) =>
    !isChange(i) && typeof ops[i]!.line === 'string';

  const hunks: FilePatch['hunks'] = [];
  let shownUntil = 0;
  let i = 0;
  while (i < ops.length) {
    if (!isChange(i)) {
      i++;
      continue;
    }
    let start = i;
    while (
      start > shownUntil &&
      i - start < CONTEXT_LINES &&
      isShowableContext(start - 1)
    ) {
      start--;
    }
    // Changes separated by no more than both hunks' context share one hunk, as in `diff -u`.
    let end = i;
    for (let j = i + 1; j < ops.length; j++) {
      if (isChange(j)) {
        end = j;
        continue;
      }
      let k = j;
      while (k < ops.length && isShowableContext(k)) {
        k++;
      }
      if (k < ops.length && isChange(k) && k - j <= CONTEXT_LINES * 2) {
        end = k;
        j = k;
        continue;
      }
      break;
    }
    let stop = end + 1;
    while (
      stop < ops.length &&
      stop - end - 1 < CONTEXT_LINES &&
      isShowableContext(stop)
    ) {
      stop++;
    }

    const lines: DiffLine[] = [];
    for (let j = start; j < stop; j++) {
      const op = ops[j]!;
      if (typeof op.line !== 'string') {
        continue;
      }
      lines.push({
        diff_line_no: null,
        line_type: op.type,
        source_line_no: op.type === DiffLineType.ADDED ? null : op.before.source + 1,
        target_line_no: op.type === DiffLineType.REMOVED ? null : op.before.target + 1,
        value: `${op.line}\n`,
      });
    }
    const sourceLength = lines.filter(l => l.line_type !== DiffLineType.ADDED).length;
    const targetLength = lines.filter(l => l.line_type !== DiffLineType.REMOVED).length;
    const first = ops[start]!.before;
    // An empty side is numbered from the line before it (`@@ -5,0 +6,2 @@`).
    hunks.push({
      lines,
      section_header: '',
      source_start: sourceLength ? first.source + 1 : first.source,
      source_length: sourceLength,
      target_start: targetLength ? first.target + 1 : first.target,
      target_length: targetLength,
    });
    shownUntil = stop;
    i = stop;
  }
  return hunks;
}
