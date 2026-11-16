import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';

import {withPreviousAttempt} from './useToggleSingleRunChat';

function makeSingleRun(blocks: ExplorerAutofixState['blocks']): ExplorerAutofixState {
  return {
    run_id: 1,
    feature_id: 'autofix_single_run',
    status: 'completed',
    updated_at: '2026-11-16T10:00:00Z',
    blocks,
  } as ExplorerAutofixState;
}

describe('withPreviousAttempt', () => {
  it('cites the previous root cause alongside the feedback', () => {
    const runState = makeSingleRun([
      {
        id: 'block-1',
        message: {role: 'assistant', content: ''},
        timestamp: '2026-11-16T10:00:00Z',
        artifacts: [
          {
            key: 'single_run_root_cause',
            reason: 'found',
            data: {headline: 'Cache sidecar is down', cause: 'Nothing on 6399.'},
          },
        ],
      },
    ] as unknown as ExplorerAutofixState['blocks']);

    expect(withPreviousAttempt(runState, "I don't like this")).toBe(
      "Starting over. Last attempt found: Cache sidecar is down\n\nFeedback: I don't like this"
    );
  });

  it('keeps the feedback as is when there was no root cause', () => {
    expect(withPreviousAttempt(makeSingleRun([]), 'Look at the worker')).toBe(
      'Look at the worker'
    );
  });
});
