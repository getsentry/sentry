import {
  AutofixRepoPRStateFixture,
  ExplorerAutofixBlockFixture,
  ExplorerAutofixFixture as explorerAutofixFixture,
  ExplorerAutofixStateFixture,
} from 'sentry-fixture/autofix';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DiffFileType} from 'sentry/components/events/autofix/types';
import {
  getOrderedAutofixSections,
  type ExplorerAutofixState,
} from 'sentry/components/events/autofix/useExplorerAutofix';

import {FeedbackList, usePrIterationFeedback} from './feedbackList';

function IterationFeedback({state}: {state: ExplorerAutofixState}) {
  const section = getOrderedAutofixSections(state).find(
    item => item.step === 'code_changes'
  )!;
  const {feedback} = usePrIterationFeedback(
    section,
    explorerAutofixFixture({runState: state})
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

  it('lists PR feedback on a single run', () => {
    const state = ExplorerAutofixStateFixture({
      status: 'completed',
      feature_id: 'autofix_single_run',
      blocks: [
        ExplorerAutofixBlockFixture({
          id: 'single-run',
          artifacts: [],
          message: {role: 'assistant', content: 'Fixed', metadata: {step: 'single_run'}},
          merged_file_patches: [
            {
              repo_name: 'org/repo',
              diff: 'diff',
              patch: {
                added: 1,
                removed: 0,
                path: 'a.py',
                source_file: 'a.py',
                target_file: 'a.py',
                type: DiffFileType.MODIFIED,
                hunks: [],
              },
            },
          ],
        }),
        ExplorerAutofixBlockFixture({
          id: 'pr-feedback',
          artifacts: [],
          message: {
            role: 'user',
            content: 'rename it',
            metadata: {
              step: 'pr_iteration',
              iteration_index: '1',
              feedback: JSON.stringify([
                {
                  text: 'rename it',
                  source: {
                    type: 'github-pr-comment',
                    comment: {
                      id: 1,
                      body: 'rename it',
                      html_url: 'https://github.com/org/repo/pull/12#issuecomment-1',
                      user: {login: 'octo'},
                    },
                  },
                },
              ]),
            },
          },
        }),
        ExplorerAutofixBlockFixture({
          id: 'reply',
          artifacts: [],
          message: {role: 'assistant', content: 'Renamed', metadata: null},
        }),
      ],
    });

    render(<IterationFeedback state={state} />);

    expect(screen.getByText('rename it')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-processed')).toBeInTheDocument();
  });
});
