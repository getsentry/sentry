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

function IterationFeedback({state}: {state: ExplorerAutofixState}) {
  const section = getOrderedAutofixSections(state).find(
    item => item.step === 'code_changes'
  )!;
  const {feedback} = usePrIterationFeedback(
    section,
    explorerAutofixFixture({runState: state}),
    true
  );
  return <FeedbackList items={feedback} />;
}

describe('FeedbackList', () => {
  it('shows an error when the iteration push fails because the PR branch moved', async () => {
    const state = ExplorerAutofixStateFixture({
      status: 'completed',
      blocks: [
        ExplorerAutofixBlockFixture({
          id: 'iteration-0',
          artifacts: [],
          message: {
            role: 'user',
            content: 'Please add a null check',
            metadata: {
              step: 'pr_iteration',
              iteration_index: '0',
              feedback: JSON.stringify({
                text: 'Please add a null check',
                source: {type: 'user-ui'},
              }),
            },
          },
        }),
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
    });

    render(<IterationFeedback state={state} />);

    expect(screen.getByText('Please add a null check')).toBeInTheDocument();
    const failed = screen.getByRole('img', {name: 'Feedback failed'});
    expect(screen.queryByTestId('feedback-processed')).not.toBeInTheDocument();
    await userEvent.hover(failed);
    expect(
      await screen.findByText(
        'Seer did not push these changes because it would have had to force-push over newer commits on the PR branch.'
      )
    ).toBeInTheDocument();
  });
});
