import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  buildAnalysis,
  deriveSectionKey,
  extractPatchInfo,
  extractPendingQuestion,
  INLINE_DIFF_MAX_CHANGED_LINES,
  INLINE_DIFF_MAX_FILES,
  mostRecentTimestamp,
  normalizeBulletList,
  parseRootCause,
} from 'sentry/views/seerWorkflows/overview/buildOverviewRows';
import type {SeerRun} from 'sentry/views/seerWorkflows/overview/types';

function makeBlock(step: string) {
  return {message: {role: 'assistant', content: step, metadata: {step}}};
}

function makePatch({
  repo = 'getsentry/sentry',
  path = 'src/cart.py',
  added = 1,
  removed = 0,
  lines = 1,
}: {
  added?: number;
  lines?: number;
  path?: string;
  removed?: number;
  repo?: string;
} = {}) {
  return {
    repo_name: repo,
    diff: '--- a\n+++ b',
    patch: {
      path,
      source_file: path,
      target_file: path,
      type: 'M',
      added,
      removed,
      hunks: [
        {
          section_header: '',
          source_start: 1,
          source_length: lines,
          target_start: 1,
          target_length: lines,
          lines: Array.from({length: lines}, (_, index) => ({
            value: `line ${index}`,
            line_type: '+',
            source_line_no: null,
            target_line_no: index + 1,
            diff_line_no: index + 1,
          })),
        },
      ],
    },
  };
}

function makeCodeChangesState(
  patches: Array<ReturnType<typeof makePatch>>
): ExplorerAutofixState {
  return makeState({
    status: 'completed',
    blocks: [
      {
        message: {
          role: 'assistant',
          content: 'code_changes',
          metadata: {step: 'code_changes'},
        },
        merged_file_patches: patches,
      },
    ],
  });
}

function makeState(overrides: Record<string, unknown> = {}): ExplorerAutofixState {
  return {
    status: 'completed',
    blocks: [],
    ...overrides,
  } as unknown as ExplorerAutofixState;
}

function makeRun(overrides: Partial<SeerRun> = {}): SeerRun {
  return {
    id: 'run-1',
    groupId: '2',
    source: 'autofix',
    lastTriggeredAt: '2026-07-14T09:00:00Z',
    ...overrides,
  };
}

describe('parseRootCause', () => {
  it('splits a headline from the root cause on the first pipe', () => {
    expect(
      parseRootCause('Cart total is null|Commit c5bb895 removed the guard.')
    ).toEqual({
      headline: 'Cart total is null',
      answer: 'Commit c5bb895 removed the guard.',
    });
  });

  it('splits only on the first pipe, keeping later pipes in the body', () => {
    expect(parseRootCause('Headline|body a | body b')).toEqual({
      headline: 'Headline',
      answer: 'body a | body b',
    });
  });

  it('returns the whole answer unchanged when there is no pipe', () => {
    expect(parseRootCause('No delimiter here')).toEqual({answer: 'No delimiter here'});
  });

  it('strips wrapping emphasis and quote characters from the headline', () => {
    expect(parseRootCause('**"Broken cart"**|because reasons')).toEqual({
      headline: 'Broken cart',
      answer: 'because reasons',
    });
  });

  it('treats a headline past the max length as a parse failure', () => {
    const answer = `${'word '.repeat(40)}|the cause`;
    expect(parseRootCause(answer)).toEqual({answer});
  });

  it('treats an empty headline or empty body as a parse failure', () => {
    expect(parseRootCause('|only a body')).toEqual({answer: '|only a body'});
    expect(parseRootCause('only a headline|')).toEqual({answer: 'only a headline|'});
  });
});

describe('normalizeBulletList', () => {
  it('rewrites inline bullets into their own markdown list lines', () => {
    expect(normalizeBulletList('Do this: •First •Second •Third')).toBe(
      'Do this:\n- First\n- Second\n- Third'
    );
  });

  it('handles a bullet with no trailing space', () => {
    expect(normalizeBulletList('Intro •Item')).toBe('Intro\n- Item');
  });

  it('leaves input without a bullet untouched', () => {
    expect(normalizeBulletList('A single next step.')).toBe('A single next step.');
  });

  it('drops empty items from consecutive bullets', () => {
    expect(normalizeBulletList('A ••B')).toBe('A\n- B');
  });

  it('drops a trailing empty bullet', () => {
    expect(normalizeBulletList('Intro •First •')).toBe('Intro\n- First');
  });
});

describe('mostRecentTimestamp', () => {
  it('returns the numerically latest of mixed defined candidates', () => {
    // The .500Z timestamp is later in time but sorts *before* the whole-second
    // one lexicographically ('.' < 'Z'), so this pins the numeric comparison.
    expect(
      mostRecentTimestamp(
        '2026-07-01T10:00:00Z',
        undefined,
        '2026-07-01T10:00:00.500Z',
        null
      )
    ).toBe('2026-07-01T10:00:00.500Z');
  });

  it('returns an empty string when every candidate is nullish', () => {
    expect(mostRecentTimestamp(null, undefined)).toBe('');
  });
});

describe('buildAnalysis', () => {
  it('maps an output with no question field to its positional config', () => {
    const {entries, headline} = buildAnalysis([
      {key: '', answer: 'Cart total is null|The guard was removed.'},
    ]);
    expect(headline).toBe('Cart total is null');
    expect(entries).toEqual([
      {key: 'root_cause', label: 'Root cause', answer: 'The guard was removed.'},
    ]);
  });

  it('falls back positionally when the question string matches nothing', () => {
    const {entries} = buildAnalysis([
      {key: '', question: 'not a real prompt', answer: 'A headline|a cause'},
      {key: '', question: 'still not real', answer: 'Adds a guard.'},
    ]);
    expect(entries.map(entry => entry.key)).toEqual(['root_cause', 'fix_summary']);
  });

  it('drops empty-string answers', () => {
    const {entries} = buildAnalysis([
      {key: '', answer: 'A headline|a cause'},
      {key: '', answer: ''},
      {key: '', answer: 'Confirm the config value.'},
    ]);
    expect(entries.map(entry => entry.key)).toEqual(['root_cause', 'next_steps']);
  });
});

describe('extractPatchInfo', () => {
  it('renders inline at exactly the changed-line limit', () => {
    const {inlinePatches, patchStats} = extractPatchInfo(
      makeCodeChangesState([
        makePatch({added: INLINE_DIFF_MAX_CHANGED_LINES, removed: 0, lines: 3}),
      ])
    );
    expect(patchStats?.added).toBe(INLINE_DIFF_MAX_CHANGED_LINES);
    expect(inlinePatches).toHaveLength(1);
  });

  it('falls back to a pill one line over the changed-line limit', () => {
    const {inlinePatches, patchStats} = extractPatchInfo(
      makeCodeChangesState([
        makePatch({added: INLINE_DIFF_MAX_CHANGED_LINES + 1, removed: 0, lines: 3}),
      ])
    );
    expect(patchStats?.added).toBe(INLINE_DIFF_MAX_CHANGED_LINES + 1);
    expect(inlinePatches).toBeUndefined();
  });

  it('renders inline at exactly the file limit', () => {
    const patches = Array.from({length: INLINE_DIFF_MAX_FILES}, (_, index) =>
      makePatch({path: `src/file${index}.py`, added: 1, removed: 0, lines: 1})
    );
    const {inlinePatches} = extractPatchInfo(makeCodeChangesState(patches));
    expect(inlinePatches).toHaveLength(INLINE_DIFF_MAX_FILES);
  });

  it('falls back to a pill one file over the file limit', () => {
    const patches = Array.from({length: INLINE_DIFF_MAX_FILES + 1}, (_, index) =>
      makePatch({path: `src/file${index}.py`, added: 1, removed: 0, lines: 1})
    );
    const {inlinePatches, patchStats} = extractPatchInfo(makeCodeChangesState(patches));
    expect(inlinePatches).toBeUndefined();
    expect(patchStats?.files).toBe(INLINE_DIFF_MAX_FILES + 1);
  });

  it('prefixes file paths with the repo when the diff spans repos', () => {
    const {inlinePatches, patchStats} = extractPatchInfo(
      makeCodeChangesState([
        makePatch({repo: 'getsentry/sentry', path: 'src/a.py', added: 1, lines: 1}),
        makePatch({repo: 'getsentry/getsentry', path: 'src/b.py', added: 1, lines: 1}),
      ])
    );
    expect(patchStats?.fileList.map(file => file.path).sort()).toEqual([
      'getsentry/getsentry:src/b.py',
      'getsentry/sentry:src/a.py',
    ]);
    expect(inlinePatches?.every(patch => patch.repoName !== undefined)).toBe(true);
  });
});

describe('extractPendingQuestion', () => {
  it('returns nothing when the run is not awaiting user input', () => {
    expect(extractPendingQuestion(makeState({status: 'completed'}))).toBeUndefined();
    expect(extractPendingQuestion(null)).toBeUndefined();
  });

  it('reads the canonical questions[0].question shape', () => {
    const state = makeState({
      status: 'awaiting_user_input',
      pending_user_input: {data: {questions: [{question: 'Which env?'}]}},
    });
    expect(extractPendingQuestion(state)).toBe('Which env?');
  });

  it('falls back to the flat question / text / message keys in order', () => {
    for (const key of ['question', 'text', 'message']) {
      const state = makeState({
        status: 'awaiting_user_input',
        pending_user_input: {data: {[key]: `via ${key}`}},
      });
      expect(extractPendingQuestion(state)).toBe(`via ${key}`);
    }
  });

  it('ignores blank or missing payloads', () => {
    const blankNested = makeState({
      status: 'awaiting_user_input',
      pending_user_input: {data: {questions: [{question: '   '}]}},
    });
    expect(extractPendingQuestion(blankNested)).toBeUndefined();

    const blankFlat = makeState({
      status: 'awaiting_user_input',
      pending_user_input: {data: {question: '  '}},
    });
    expect(extractPendingQuestion(blankFlat)).toBeUndefined();

    const noPayload = makeState({status: 'awaiting_user_input'});
    expect(extractPendingQuestion(noPayload)).toBeUndefined();
  });
});

describe('deriveSectionKey', () => {
  const cases: Array<{
    expected: string;
    name: string;
    run: SeerRun | null;
    state: ExplorerAutofixState | null;
  }> = [
    {
      name: 'a merged PR beats every reached step',
      run: makeRun({pullRequests: [{status: 'merged'}]}),
      state: makeState({
        blocks: [makeBlock('code_changes')],
        repo_pr_states: {r: {pr_creation_status: 'completed'}},
      }),
      expected: 'merged',
    },
    {
      name: 'a created PR beats code changes',
      run: makeRun(),
      state: makeState({
        blocks: [makeBlock('code_changes')],
        repo_pr_states: {r: {pr_creation_status: 'completed'}},
      }),
      expected: 'review_pr',
    },
    {
      name: 'code changes beat a solution',
      run: makeRun(),
      state: makeState({blocks: [makeBlock('solution'), makeBlock('code_changes')]}),
      expected: 'code_changes_ready',
    },
    {
      name: 'a coding-agents-only run reads as code changes ready',
      run: makeRun(),
      state: makeState({blocks: [makeBlock('coding_agents')]}),
      expected: 'code_changes_ready',
    },
    {
      name: 'a solution beats the floor',
      run: makeRun(),
      state: makeState({blocks: [makeBlock('root_cause'), makeBlock('solution')]}),
      expected: 'solution_ready',
    },
    {
      name: 'a diagnosis-only run falls to needs_investigation',
      run: makeRun(),
      state: makeState({blocks: [makeBlock('root_cause')]}),
      expected: 'needs_investigation',
    },
    {
      name: 'a null run and state fall to needs_investigation',
      run: null,
      state: null,
      expected: 'needs_investigation',
    },
  ];

  it.each(cases)('$name', ({run, state, expected}) => {
    expect(deriveSectionKey(run, state)).toBe(expected);
  });
});
