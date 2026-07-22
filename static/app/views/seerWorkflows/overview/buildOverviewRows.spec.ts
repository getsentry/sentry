import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';

import {
  deriveSectionKey,
  extractPendingQuestion,
  normalizeBulletList,
  parseRootCause,
} from 'sentry/views/seerWorkflows/overview/buildOverviewRows';
import type {SeerRun} from 'sentry/views/seerWorkflows/overview/types';

function makeBlock(step: string) {
  return {message: {role: 'assistant', content: step, metadata: {step}}};
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
    expect(parseRootCause('Cart total is null|Commit c5bb895 removed the guard.')).toEqual(
      {
        headline: 'Cart total is null',
        answer: 'Commit c5bb895 removed the guard.',
      }
    );
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
