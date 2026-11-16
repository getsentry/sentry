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
  type PrIterationOutOfCreditsWarning,
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

  function iterationBlocks() {
    return [
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
    ];
  }

  it('says the iteration stopped for credits', async () => {
    const state = ExplorerAutofixStateFixture({
      status: 'error',
      failure_reason: 'out_of_credits',
      blocks: [
        ...iterationBlocks(),
        ExplorerAutofixBlockFixture({
          id: 'error-1',
          artifacts: [],
          message: {
            role: 'assistant',
            content: "Your organization doesn't have enough Seer credits for this.",
            metadata: null,
          },
        }),
      ],
    });

    render(<IterationFeedback state={state} />);

    await userEvent.hover(screen.getByRole('img', {name: 'Feedback failed'}));
    expect(
      await screen.findByText(
        "Seer couldn't finish this feedback because your organization is out of credits."
      )
    ).toBeInTheDocument();
  });

  it('says the iteration push failed for credits', async () => {
    const state = ExplorerAutofixStateFixture({
      status: 'completed',
      blocks: [
        ...iterationBlocks(),
        ExplorerAutofixBlockFixture({
          id: 'iteration-completed',
          artifacts: [],
          message: {role: 'assistant', content: 'Done', metadata: null},
        }),
      ],
      repo_pr_states: {
        'org/repo': AutofixRepoPRStateFixture({
          pr_creation_status: 'error',
          pr_creation_error_code: 'out_of_credits',
        }),
      },
    });

    render(<IterationFeedback state={state} />);

    await userEvent.hover(screen.getByRole('img', {name: 'Feedback failed'}));
    expect(
      await screen.findByText(
        "Seer couldn't finish this feedback because your organization is out of credits."
      )
    ).toBeInTheDocument();
  });

  function completedBlock() {
    return ExplorerAutofixBlockFixture({
      id: 'iteration-completed',
      artifacts: [],
      message: {role: 'assistant', content: 'Done', metadata: null},
    });
  }

  function outOfCreditsWarning(
    overrides: Partial<PrIterationOutOfCreditsWarning> = {}
  ): PrIterationOutOfCreditsWarning {
    return {
      warning_type: 'pr_iteration_out_of_credits',
      unfinished_action: null,
      unfinished_iteration_index: null,
      held_feedback_count: 0,
      ...overrides,
    };
  }

  it('shows queued feedback held for credits as waiting', async () => {
    const state = ExplorerAutofixStateFixture({
      status: 'completed',
      blocks: iterationBlocks(),
      queued_feedback: [
        {text: 'Make the button blue', source: {type: 'user-ui'}, held_for_credits: true},
      ],
      warnings: [outOfCreditsWarning({held_feedback_count: 1})],
    });

    render(<IterationFeedback state={state} />);

    expect(screen.getByText('Queued')).toBeInTheDocument();
    await userEvent.hover(screen.getByRole('img', {name: 'Waiting for credits'}));
    expect(
      await screen.findByText(
        'Waiting for credits. Seer picks this up the next time it iterates on the pull request.'
      )
    ).toBeInTheDocument();
  });

  it('shows an iteration whose push is held for credits as waiting, not pushed', async () => {
    // Sentry refused the push, so the repo has no push error for the frontend to see.
    const state = ExplorerAutofixStateFixture({
      status: 'completed',
      blocks: [...iterationBlocks(), completedBlock()],
      warnings: [
        outOfCreditsWarning({unfinished_action: 'push', unfinished_iteration_index: 0}),
      ],
    });

    render(<IterationFeedback state={state} />);

    expect(screen.queryByTestId('feedback-processed')).not.toBeInTheDocument();
    await userEvent.hover(screen.getByRole('img', {name: 'Waiting for credits'}));
    expect(
      await screen.findByText(
        "Seer couldn't push the latest changes because your organization is out of credits. It pushes them the next time it iterates on the pull request."
      )
    ).toBeInTheDocument();
  });

  it('shows a branch-moved retry held for credits as waiting, not refused', async () => {
    const state = ExplorerAutofixStateFixture({
      status: 'completed',
      blocks: [...iterationBlocks(), completedBlock()],
      repo_pr_states: {
        'org/repo': AutofixRepoPRStateFixture({
          pr_creation_status: 'error',
          pr_creation_error_code: 'branch_moved',
        }),
      },
      warnings: [
        outOfCreditsWarning({
          unfinished_action: 'branch_moved_retry',
          unfinished_iteration_index: 0,
        }),
      ],
    });

    render(<IterationFeedback state={state} />);

    expect(screen.queryByRole('img', {name: 'Feedback failed'})).not.toBeInTheDocument();
    await userEvent.hover(screen.getByRole('img', {name: 'Waiting for credits'}));
    expect(
      await screen.findByText(
        "Seer couldn't retry the latest changes on the pull request's newer commits because your organization is out of credits. It retries the next time it iterates on the pull request."
      )
    ).toBeInTheDocument();
  });

  it('shows queued feedback as paused once iteration is paused', async () => {
    const state = ExplorerAutofixStateFixture({
      status: 'completed',
      blocks: iterationBlocks(),
      pr_iteration_paused: true,
      queued_feedback: [
        {text: 'Make the button blue', source: {type: 'user-ui'}, held_for_credits: true},
      ],
    });

    render(<IterationFeedback state={state} />);

    expect(screen.queryByText('Queued')).not.toBeInTheDocument();
    await userEvent.hover(screen.getByRole('img', {name: 'Paused'}));
    expect(
      await screen.findByText(
        "Seer stopped iterating on this pull request, so this feedback won't run."
      )
    ).toBeInTheDocument();
  });
});
