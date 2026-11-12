import {
  DiffFileType,
  DiffLineType,
  type FilePatch,
} from 'sentry/components/events/autofix/types';
import type {PullRequestFileChangeType} from 'sentry/types/integrations';

interface RawPullRequestFile {
  additions: number;
  changeType: PullRequestFileChangeType | null;
  deletions: number;
  patch: string | null;
  path: string;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

const LINE_TYPE_BY_PREFIX: Record<string, DiffLineType> = {
  ' ': DiffLineType.CONTEXT,
  '+': DiffLineType.ADDED,
  '-': DiffLineType.REMOVED,
};

function toDiffFileType(changeType: PullRequestFileChangeType | null): DiffFileType {
  if (changeType === 'ADDED') {
    return DiffFileType.ADDED;
  }
  if (changeType === 'DELETED') {
    return DiffFileType.DELETED;
  }
  return DiffFileType.MODIFIED;
}

// The provider's per-file `patch` is hunks-only (no ---/+++ headers): a series
// of `@@ -s,l +s,l @@` blocks whose lines are prefixed with ' ', '+' or '-'.
export function parseFilePatch({
  path,
  patch,
  additions,
  deletions,
  changeType,
}: RawPullRequestFile): FilePatch {
  const hunks: FilePatch['hunks'] = [];
  let diffLineNo = 0;
  // Line offsets reset each hunk: removed lines advance only source, added
  // lines only target, context lines both.
  let priorSource = 0;
  let priorTarget = 0;

  for (const rawLine of patch?.split('\n') ?? []) {
    const header = rawLine.match(HUNK_HEADER);
    if (header) {
      hunks.push({
        source_start: Number(header[1]),
        source_length: header[2] ? Number(header[2]) : 1,
        target_start: Number(header[3]),
        target_length: header[4] ? Number(header[4]) : 1,
        section_header: (header[5] ?? '').trim(),
        lines: [],
      });
      priorSource = 0;
      priorTarget = 0;
      continue;
    }

    const hunk = hunks.at(-1);
    const lineType = LINE_TYPE_BY_PREFIX[rawLine[0] ?? ''];
    if (!hunk || !lineType) {
      continue; // preamble, "\ No newline at end of file", or stray lines
    }

    diffLineNo += 1;
    hunk.lines.push({
      line_type: lineType,
      value: rawLine.slice(1),
      source_line_no:
        lineType === DiffLineType.ADDED ? null : hunk.source_start + priorSource,
      target_line_no:
        lineType === DiffLineType.REMOVED ? null : hunk.target_start + priorTarget,
      diff_line_no: diffLineNo,
    });
    if (lineType !== DiffLineType.ADDED) {
      priorSource += 1;
    }
    if (lineType !== DiffLineType.REMOVED) {
      priorTarget += 1;
    }
  }

  return {
    path,
    source_file: path,
    target_file: path,
    type: toDiffFileType(changeType),
    added: additions,
    removed: deletions,
    hunks,
  };
}
