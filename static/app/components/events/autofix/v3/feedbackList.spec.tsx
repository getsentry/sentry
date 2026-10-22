import {
  AutofixRepoPRStateFixture,
  ExplorerAutofixBlockFixture,
  ExplorerAutofixFixture as explorerAutofixFixture,
  ExplorerAutofixStateFixture,
} from 'sentry-fixture/autofix';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  getOrderedAutofixSections,
  type ExplorerAutofixState,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  FeedbackList,
  usePrIterationFeedback,
} from 'sentry/components/events/autofix/v3/feedbackList';

function iterationBlock(index: number, text: string) {
  return ExplorerAutofixBlockFixture({
    id: `iteration-${index}`,
    artifacts: [],
    message: {
      role: 'user',
      content: text,
      metadata: {
        step: 'pr_iteration',
        iteration_index: String(index),
        feedback: JSON.stringify({text, source: {type: 'user-ui'}}),
      },
    },
  });
}

function feedbackState(overrides: Partial<ExplorerAutofixState> = {}) {
  return ExplorerAutofixStateFixture({
    blocks: [
      iterationBlock(0, 'First feedback'),
      iterationBlock(1, 'Latest feedback'),
      ExplorerAutofixBlockFixture({
        id: 'iteration-completed',
        artifacts: [],
        message: {role: 'assistant', content: 'Done', metadata: null},
      }),
    ],
    repo_pr_states: {
      'org/repo': AutofixRepoPRStateFixture({
        pr_creation_status: 'error',
        pr_creation_error_code: 'branch_moved',
      }),
    },
    ...overrides,
  });
}

function IterationFeedback({
  state,
  enabled = true,
}: {
  state: ExplorerAutofixState;
  enabled?: boolean;
}) {
  const section = getOrderedAutofixSections(state).find(
    item => item.step === 'code_changes'
  )!;
  const {feedback} = usePrIterationFeedback(
    section,
    explorerAutofixFixture({runState: state}),
    enabled
  );
  return <FeedbackList items={feedback} />;
}

describe('FeedbackList', () => {
  it.each([
    "The pull request's branch has commits newer than the code Seer edited, so pushing would have to force-push over them.",
    "This branch has commits Seer didn't push, so Seer did not overwrite them.",
    'A different error message from Seer.',
  ])('explains branch_moved independently of the error message: %s', async message => {
    render(
      <IterationFeedback
        state={feedbackState({
          repo_pr_states: {
            'org/repo': AutofixRepoPRStateFixture({
              pr_creation_status: 'error',
              pr_creation_error_code: 'branch_moved',
              pr_creation_error: message,
            }),
          },
        })}
      />
    );

    expect(screen.getByText('Latest feedback')).toBeInTheDocument();
    const failed = screen.getByRole('img', {name: 'Feedback failed'});
    await userEvent.hover(failed);
    expect(
      await screen.findByText(
        'Seer did not push these changes because it would have had to force-push over newer commits on the PR branch.'
      )
    ).toBeInTheDocument();
    // The older iteration stays successful, not failed by the latest push.
    expect(screen.getAllByTestId('feedback-processed')).toHaveLength(1);
    expect(
      screen.queryByText('Changes from this feedback have been pushed')
    ).not.toBeInTheDocument();
  });

  it.each([undefined, null, 'another_error'])(
    'shows a generic push error for error code %s',
    async errorCode => {
      render(
        <IterationFeedback
          state={feedbackState({
            repo_pr_states: {
              'org/repo': AutofixRepoPRStateFixture({
                pr_creation_status: 'error',
                pr_creation_error_code: errorCode,
                pr_creation_error:
                  "This branch has commits Seer didn't push, so Seer did not overwrite them.",
              }),
            },
          })}
        />
      );

      await userEvent.hover(screen.getByRole('img', {name: 'Feedback failed'}));
      expect(
        await screen.findByText('Changes from this feedback could not be pushed')
      ).toBeInTheDocument();
    }
  );

  it('still shows the pushed state after a successful push', async () => {
    render(
      <IterationFeedback
        state={feedbackState({
          repo_pr_states: {'org/repo': AutofixRepoPRStateFixture()},
        })}
      />
    );

    expect(screen.queryByRole('img', {name: 'Feedback failed'})).not.toBeInTheDocument();
    expect(screen.getAllByTestId('feedback-processed')).toHaveLength(2);
    await userEvent.hover(screen.getAllByTestId('feedback-processed')[0]!);
    expect(
      await screen.findByText('Changes from this feedback have been pushed')
    ).toBeInTheDocument();
  });

  it.each(['processing', 'awaiting_user_input'] as const)(
    'does not mark an unfinished %s iteration failed from a stale push error',
    status => {
      render(<IterationFeedback state={feedbackState({status})} />);

      expect(screen.getByText('Latest feedback')).toBeInTheDocument();
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      expect(
        screen.queryByRole('img', {name: 'Feedback failed'})
      ).not.toBeInTheDocument();
      expect(screen.getAllByTestId('feedback-processed')).toHaveLength(1);
    }
  );

  it('waits for all repos to finish pushing before showing an error', () => {
    render(
      <IterationFeedback
        state={feedbackState({
          repo_pr_states: {
            'org/repo': AutofixRepoPRStateFixture({
              pr_creation_status: 'error',
              pr_creation_error_code: 'branch_moved',
            }),
            'org/other-repo': AutofixRepoPRStateFixture({
              repo_name: 'org/other-repo',
              pr_creation_status: 'creating',
            }),
          },
        })}
      />
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByRole('img', {name: 'Feedback failed'})).not.toBeInTheDocument();
  });

  it('keeps queued feedback queued when the latest push fails', () => {
    render(
      <IterationFeedback
        state={feedbackState({
          queued_feedback: [{text: 'Queued feedback', source: {type: 'user-ui'}}],
        })}
      />
    );

    expect(screen.getByText('Queued feedback')).toBeInTheDocument();
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getAllByRole('img', {name: 'Feedback failed'})).toHaveLength(1);
  });

  it('does not show feedback when iteration is disabled', () => {
    render(<IterationFeedback state={feedbackState()} enabled={false} />);

    expect(screen.queryByText('Feedback')).not.toBeInTheDocument();
  });
});
