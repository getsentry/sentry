import {structuredPatch} from 'diff';

import {
  DiffFileType,
  DiffLineType,
  type DiffLine,
  type FilePatch,
} from 'sentry/components/events/autofix/types';
import {
  composePatches,
  diffPatches,
  getRunChanges,
  type PullRequestDiff,
} from 'sentry/views/seerExplorer/runChanges';
import type {
  Block,
  ExplorerFilePatch,
  RepoPRState,
} from 'sentry/views/seerExplorer/types';

const REPO = 'getsentry/sentry';

/** A FilePatch shaped like Seer's (unidiff lines, 3 lines of context). */
function makePatch(path: string, from: string | null, to: string | null): FilePatch {
  const {hunks} = structuredPatch(path, path, from ?? '', to ?? '', '', '', {context: 3});
  return {
    path,
    source_file: from === null ? '/dev/null' : path,
    target_file: to === null ? '/dev/null' : path,
    type:
      from === null
        ? DiffFileType.ADDED
        : to === null
          ? DiffFileType.DELETED
          : DiffFileType.MODIFIED,
    added: hunks.flatMap(h => h.lines).filter(l => l.startsWith('+')).length,
    removed: hunks.flatMap(h => h.lines).filter(l => l.startsWith('-')).length,
    hunks: hunks.map(hunk => {
      let source = hunk.oldStart;
      let target = hunk.newStart;
      const lines: DiffLine[] = hunk.lines
        .filter(line => !line.startsWith('\\'))
        .map(line => {
          const type = line[0] as DiffLineType;
          const diffLine: DiffLine = {
            diff_line_no: null,
            line_type: type,
            source_line_no: type === DiffLineType.ADDED ? null : source,
            target_line_no: type === DiffLineType.REMOVED ? null : target,
            value: `${line.slice(1)}\n`,
          };
          source += type === DiffLineType.ADDED ? 0 : 1;
          target += type === DiffLineType.REMOVED ? 0 : 1;
          return diffLine;
        });
      return {
        lines,
        section_header: '',
        // jsdiff numbers an empty side from the next line; unidiff, like `diff -u`, from the one before.
        source_start: hunk.oldLines ? hunk.oldStart : hunk.oldStart - 1,
        source_length: hunk.oldLines,
        target_start: hunk.newLines ? hunk.newStart : hunk.newStart - 1,
        target_length: hunk.newLines,
      };
    }),
  };
}

function numbered(count: number, edits: Record<number, string> = {}) {
  return Array.from({length: count}, (_, i) => edits[i + 1] ?? `line ${i + 1}`)
    .join('\n')
    .concat('\n');
}

function changedLines(patch: FilePatch | null) {
  return (patch?.hunks ?? []).flatMap(hunk =>
    hunk.lines
      .filter(line => line.line_type !== DiffLineType.CONTEXT)
      .map(
        line =>
          `${line.line_type}${line.source_line_no ?? line.target_line_no} ${line.value.trimEnd()}`
      )
  );
}

function filePatch(path: string, from: string | null, to: string | null) {
  return {repo_name: REPO, patch: makePatch(path, from, to), diff: ''};
}

function block(id: string, fields: Partial<Block> = {}): Block {
  return {
    id,
    message: {role: 'assistant', content: ''},
    timestamp: '2026-10-28T00:00:00Z',
    ...fields,
  };
}

const prState: RepoPRState = {
  repo_name: REPO,
  branch_name: 'seer/fix',
  commit_sha: 'abc123',
  pr_creation_error: null,
  pr_creation_status: 'completed',
  pr_id: '1',
  pr_number: 42,
  pr_url: 'https://github.com/getsentry/sentry/pull/42',
  title: 'Fix it',
};

describe('diffPatches', () => {
  it('drops what was already pushed from a file edited before and after the push', () => {
    const base = numbered(40);
    const pushed = numbered(40, {3: 'pushed edit'});
    const current = numbered(40, {3: 'pushed edit', 30: 'new edit'});

    const patch = diffPatches(
      makePatch('a.py', base, pushed),
      makePatch('a.py', base, current)
    );

    expect(patch?.type).toBe(DiffFileType.MODIFIED);
    expect(changedLines(patch)).toEqual(['-30 line 30', '+30 new edit']);
    expect(patch?.hunks[0]).toEqual(
      expect.objectContaining({source_start: 27, source_length: 7, target_start: 27})
    );
  });

  it('diffs a change to a pushed line against the pushed version', () => {
    const base = numbered(10);
    const pushed = numbered(10, {5: 'pushed edit'});
    const current = numbered(10, {5: 'second edit'});

    const patch = diffPatches(
      makePatch('a.py', base, pushed),
      makePatch('a.py', base, current)
    );

    expect(changedLines(patch)).toEqual(['-5 pushed edit', '+5 second edit']);
  });

  it('numbers lines after an earlier pushed insertion', () => {
    const base = numbered(40);
    const pushed = `${numbered(2)}inserted 1\ninserted 2\n${numbered(40).split('\n').slice(2).join('\n')}`;
    const current = pushed.replace('line 35', 'new edit');

    const patch = diffPatches(
      makePatch('a.py', base, pushed),
      makePatch('a.py', base, current)
    );

    expect(changedLines(patch)).toEqual(['-37 line 35', '+37 new edit']);
  });

  it('returns null when the unpushed edits put the file back as it was pushed', () => {
    const base = numbered(10);
    const pushed = numbered(10, {5: 'pushed edit'});

    expect(
      diffPatches(makePatch('a.py', base, pushed), makePatch('a.py', base, pushed))
    ).toBeNull();
  });

  it('diffs a file the run created, then changed after pushing it', () => {
    const pushed = 'one\ntwo\n';
    const current = 'one\nTWO\nthree\n';

    const patch = diffPatches(
      makePatch('new.py', null, pushed),
      makePatch('new.py', null, current)
    );

    expect(patch?.type).toBe(DiffFileType.MODIFIED);
    expect(changedLines(patch)).toEqual(['-2 two', '+2 TWO', '+3 three']);
  });

  it('marks a pushed file deleted afterwards as deleted', () => {
    const base = numbered(5);
    const pushed = numbered(5, {2: 'pushed edit'});

    const patch = diffPatches(
      makePatch('a.py', base, pushed),
      makePatch('a.py', base, null)
    );

    expect(patch?.type).toBe(DiffFileType.DELETED);
    expect(patch?.removed).toBe(5);
  });
});

/** A provider's per-file patch: hunks only, as GitHub's PR files API returns them. */
function providerPatch(from: string, to: string) {
  return structuredPatch('', '', from, to, '', '', {context: 3})
    .hunks.map(hunk =>
      [
        `@@ -${hunk.oldLines ? hunk.oldStart : hunk.oldStart - 1},${hunk.oldLines} +${hunk.newLines ? hunk.newStart : hunk.newStart - 1},${hunk.newLines} @@`,
        ...hunk.lines.filter(line => !line.startsWith('\\')),
      ].join('\n')
    )
    .join('\n');
}

/** `text` with `patch` applied, checking every line the patch expects to find. */
function applyPatch(text: string | null, patch: FilePatch | null) {
  const before = text === null ? [] : text.split('\n').slice(0, -1);
  if (!patch) {
    return text;
  }
  if (patch.type === DiffFileType.DELETED) {
    return null;
  }
  const after: string[] = [];
  let next = 1;
  for (const hunk of patch.hunks) {
    const start = hunk.source_length ? hunk.source_start : hunk.source_start + 1;
    after.push(...before.slice(next - 1, start - 1));
    next = start;
    for (const line of hunk.lines) {
      const value = line.value.replace(/\n$/, '');
      if (line.line_type !== DiffLineType.ADDED) {
        expect(before[next - 1]).toBe(value);
        next++;
      }
      if (line.line_type !== DiffLineType.REMOVED) {
        after.push(value);
      }
    }
  }
  after.push(...before.slice(next - 1));
  return after.map(line => `${line}\n`).join('');
}

describe('composePatches', () => {
  it('composes a PR diff with edits on its head', () => {
    const base = numbered(40);
    const head = numbered(40, {3: 'pr edit'});
    const current = numbered(40, {3: 'pr edit', 30: 'new edit'});

    const patch = composePatches(
      makePatch('a.py', base, head),
      makePatch('a.py', head, current)
    );

    expect(changedLines(patch)).toEqual([
      '-3 line 3',
      '+3 pr edit',
      '-30 line 30',
      '+30 new edit',
    ]);
  });

  it('returns null when the edits undo the PR', () => {
    const base = numbered(10);
    const head = numbered(10, {5: 'pr edit'});

    expect(
      composePatches(makePatch('a.py', base, head), makePatch('a.py', head, base))
    ).toBeNull();
  });

  it('matches applying both patches in turn', () => {
    // A small deterministic generator, so a failure reproduces.
    let seed = 7;
    const random = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    const mutate = (text: string, label: string) => {
      const lines = text.split('\n').slice(0, -1);
      for (let edits = random(4) + 1; edits > 0; edits--) {
        const at = random(lines.length + 1);
        const kind = random(3);
        if (kind === 0) {
          lines.splice(at, 0, `${label} ${random(1000)}`);
        } else if (kind === 1 && lines.length > 1) {
          lines.splice(Math.min(at, lines.length - 1), 1);
        } else {
          lines[Math.min(at, lines.length - 1)] = `${label} ${random(1000)}`;
        }
      }
      return lines.map(line => `${line}\n`).join('');
    };

    for (let i = 0; i < 300; i++) {
      const base = numbered(random(60) + 5);
      const head = mutate(base, 'pr');
      const current = mutate(head, 'edit');

      const patch = composePatches(
        makePatch('a.py', base, head),
        makePatch('a.py', head, current)
      );

      expect(applyPatch(base, patch)).toBe(current);
    }
  });
});

describe('getRunChanges', () => {
  const base = numbered(40);
  const pushed = numbered(40, {3: 'pushed edit'});
  const current = numbered(40, {3: 'pushed edit', 30: 'new edit'});
  const pushedThenEdited = [
    block('1', {
      file_patches: [filePatch('b.py', base, pushed), filePatch('a.py', 'x\n', 'y\n')],
      merged_file_patches: [
        filePatch('b.py', base, pushed),
        filePatch('a.py', 'x\n', 'y\n'),
      ],
      pr_commit_shas: {[REPO]: 'abc123'},
    }),
    block('2', {
      file_patches: [
        filePatch('b.py', pushed, current),
        filePatch('c.py', null, 'new\n'),
      ],
      merged_file_patches: [
        filePatch('b.py', base, current),
        filePatch('c.py', null, 'new\n'),
      ],
    }),
  ];
  const prDiff: PullRequestDiff = {
    status: 'success',
    files: [
      {
        path: 'b.py',
        patch: providerPatch(base, pushed),
        previousPath: null,
        status: 'modified',
      },
      {
        path: 'a.py',
        patch: providerPatch('x\n', 'y\n'),
        previousPath: null,
        status: 'modified',
      },
    ],
  };

  it('returns the changes after the last push, against what was pushed', () => {
    const [changes] = getRunChanges(pushedThenEdited, {[REPO]: prState}, {});

    expect(changes?.prState).toBe(prState);
    expect(changes?.unpushed.files.map(file => file.patch.path)).toEqual([
      'b.py',
      'c.py',
    ]);
    expect(changedLines(changes!.unpushed.files[0]!.patch)).toEqual([
      '-30 line 30',
      '+30 new edit',
    ]);
    expect(changes?.unpushed).toEqual(expect.objectContaining({added: 2, removed: 1}));
  });

  it("puts the unpushed changes on top of the PR's diff, sorted by path", () => {
    const [changes] = getRunChanges(
      pushedThenEdited,
      {[REPO]: prState},
      {[REPO]: prDiff}
    );

    expect(changes?.allStatus).toBe('success');
    expect(changes?.all?.files.map(file => file.patch.path)).toEqual([
      'a.py',
      'b.py',
      'c.py',
    ]);
    expect(changedLines(changes!.all!.files[1]!.patch)).toEqual([
      '-3 line 3',
      '+3 pushed edit',
      '-30 line 30',
      '+30 new edit',
    ]);
    expect(changes?.all).toEqual(expect.objectContaining({added: 4, removed: 3}));
  });

  it("has no full diff until the PR's diff loads", () => {
    const [pending] = getRunChanges(pushedThenEdited, {[REPO]: prState}, {});
    const [failed] = getRunChanges(
      pushedThenEdited,
      {[REPO]: prState},
      {[REPO]: {status: 'error'}}
    );

    expect(pending).toEqual(expect.objectContaining({all: null, allStatus: 'pending'}));
    expect(failed).toEqual(expect.objectContaining({all: null, allStatus: 'error'}));
  });

  it("shows the PR's diff when nothing is unpushed", () => {
    const blocks = [
      block('1', {
        file_patches: [filePatch('a.py', 'x\n', 'y\n')],
        merged_file_patches: [filePatch('a.py', 'x\n', 'y\n')],
      }),
      block('2', {pr_commit_shas: {[REPO]: 'abc123'}}),
    ];

    const [changes] = getRunChanges(blocks, {[REPO]: prState}, {[REPO]: prDiff});

    expect(changes?.unpushed.files).toEqual([]);
    expect(changes?.all?.files.map(file => file.patch.path)).toEqual(['a.py', 'b.py']);
  });

  it('returns nothing without edits or a PR', () => {
    expect(getRunChanges([block('1')], {}, {})).toEqual([]);
  });

  it('counts every change as unpushed for a repo that has no PR yet', () => {
    const blocks = [
      block('1', {
        file_patches: [filePatch('a.py', 'x\n', 'y\n')],
        merged_file_patches: [filePatch('a.py', 'x\n', 'y\n')],
      }),
    ];

    const [changes] = getRunChanges(blocks, {}, {});

    expect(changes?.prState).toBeNull();
    expect(changedLines(changes!.unpushed.files[0]!.patch)).toEqual(['-1 x', '+1 y']);
    expect(changes?.all).toBe(changes?.unpushed);
    expect(changes?.allStatus).toBe('success');
  });

  it('applies edits Seer has not merged yet on top of the PR in order', () => {
    const later = numbered(40, {3: 'pushed edit', 30: 'new edit', 35: 'later edit'});
    const blocks = [
      block('1', {
        file_patches: [filePatch('b.py', base, pushed)],
        merged_file_patches: [filePatch('b.py', base, pushed)],
        pr_commit_shas: {[REPO]: 'abc123'},
      }),
      block('2', {
        file_patches: [
          filePatch('b.py', pushed, current),
          filePatch('b.py', current, later),
        ],
      }),
    ];

    const [changes] = getRunChanges(blocks, {[REPO]: prState}, {[REPO]: prDiff});

    expect(changes?.unpushed.files).toHaveLength(2);
    expect(applyPatch(base, changes!.all!.files[1]!.patch)).toBe(later);
  });

  it('reads Code Mode patches and pushes from tool results', () => {
    const codeModeBlock = (fields: Record<string, unknown>) =>
      block('cm', {
        tool_results: [
          {
            tool_call_id: 't',
            tool_call_function: 'sentry_api_execute',
            content: '',
            structuredContent: fields as any,
          },
        ],
      });
    const blocks = [
      codeModeBlock({
        file_patches: [filePatch('a.py', 'x\n', 'y\n')],
        pr_commit_shas: {[REPO]: 'abc123'},
      }),
      codeModeBlock({file_patches: [filePatch('b.py', 'p\n', 'q\n')]}),
    ];

    const [changes] = getRunChanges(blocks, {[REPO]: prState}, {});

    // b.py has no merged patch yet, so its edit shows as made.
    expect(changes?.unpushed.files.map(file => file.patch.path)).toEqual(['b.py']);
  });

  it('measures edits after a re-pin from the new PR head', () => {
    const merged: ExplorerFilePatch[] = [filePatch('a.py', 'x\n', 'y\n')];
    const blocks = [
      block('1', {file_patches: merged, merged_file_patches: merged}),
      block('2', {
        message: {
          role: 'user',
          content: 'more',
          metadata: {patch_cutoff: JSON.stringify([REPO.toUpperCase()])},
        },
      }),
      block('3', {
        file_patches: [filePatch('b.py', 'p\n', 'q\n')],
        merged_file_patches: [filePatch('b.py', 'p\n', 'q\n')],
      }),
    ];

    const [changes] = getRunChanges(blocks, {[REPO]: prState}, {});

    expect(changes?.unpushed.files.map(file => file.patch.path)).toEqual(['b.py']);
  });
});
