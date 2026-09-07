import {
  AutofixRepoPRStateFixture,
  AutofixRootCauseArtifactFixture,
  AutofixSolutionArtifactFixture,
  ExplorerAutofixBlockFixture,
  ExplorerAutofixFixture,
  ExplorerAutofixStateFixture,
} from 'sentry-fixture/autofix';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {ExplorerFilePatch} from 'sentry/views/seerExplorer/types';

import {IssuePreviewAutofixSummary} from './issuePreviewAutofixSummary';

function makePatch(repoName: string, path: string): ExplorerFilePatch {
  return {
    repo_name: repoName,
    diff: `diff --git a/${path} b/${path}`,
    patch: {
      path,
      added: 1,
      removed: 0,
      hunks: [],
      source_file: path,
      target_file: path,
      type: 'M',
    },
  } as ExplorerFilePatch;
}

const rootCauseArtifact = AutofixRootCauseArtifactFixture({
  data: {
    one_line_description: 'An unexpected null value reached the user handler.',
    five_whys: [
      'The handler accessed the user without checking for null.',
      'The upstream lookup can return no user.',
    ],
    reproduction_steps: ['Request a user ID that does not exist.'],
  },
});

const solutionArtifact = AutofixSolutionArtifactFixture({
  data: {
    one_line_summary: 'Guard the user lookup before reading its properties.',
    steps: [
      {
        title: 'Add a null guard',
        description: 'Return a not-found response when the lookup has no user.',
      },
      {
        title: 'Cover the missing-user path',
        description: 'Add a regression test for an unknown user ID.',
      },
    ],
  },
});

describe('IssuePreviewAutofixSummary', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue(undefined)},
    });
  });

  it('renders summaries in the requested order with the first section expanded', async () => {
    const runState = ExplorerAutofixStateFixture({
      blocks: [
        ExplorerAutofixBlockFixture({artifacts: [rootCauseArtifact]}),
        ExplorerAutofixBlockFixture({
          id: 'solution',
          artifacts: [solutionArtifact],
          message: {
            content: 'Step complete',
            metadata: {step: 'solution'},
            role: 'assistant',
          },
        }),
        ExplorerAutofixBlockFixture({
          id: 'code_changes',
          artifacts: undefined,
          merged_file_patches: [
            makePatch('org/frontend', 'src/user.ts'),
            makePatch('org/backend', 'tests/test_user.py'),
          ],
          message: {
            content: 'Step complete',
            metadata: {step: 'code_changes'},
            role: 'assistant',
          },
        }),
      ],
      repo_pr_states: {
        'org/frontend': AutofixRepoPRStateFixture({
          repo_name: 'org/frontend',
          pr_number: 10,
          pr_url: 'https://github.com/org/frontend/pull/10',
        }),
        'org/backend': AutofixRepoPRStateFixture({
          repo_name: 'org/backend',
          pr_number: 20,
          pr_url: 'https://github.com/org/backend/pull/20',
        }),
        'org/pending': AutofixRepoPRStateFixture({
          repo_name: 'org/pending',
          pr_creation_status: 'creating',
          pr_number: null,
          pr_url: null,
        }),
      },
    });

    render(
      <IssuePreviewAutofixSummary
        autofix={ExplorerAutofixFixture({runState})}
        groupId="preview-group"
      />
    );

    expect(
      screen.getAllByRole('heading', {level: 3}).map(heading => heading.textContent)
    ).toEqual(['Code Changes', 'Implementation Plan', 'Root Cause']);

    const proposal = screen.getByRole('region', {name: 'Code Changes'});
    const plan = screen.getByRole('region', {name: 'Implementation Plan'});
    const rootCause = screen.getByRole('region', {name: 'Root Cause'});

    expect(within(proposal).getByRole('button', {name: 'Code Changes'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(
      within(plan).getByRole('button', {name: 'Implementation Plan'})
    ).toHaveAttribute('aria-expanded', 'false');
    expect(within(rootCause).getByRole('button', {name: 'Root Cause'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    expect(within(proposal).getByText('2 files changed in 2 repos')).toBeVisible();
    expect(
      within(plan).getByText('Guard the user lookup before reading its properties.')
    ).toBeVisible();
    expect(
      within(rootCause).getByText('An unexpected null value reached the user handler.')
    ).toBeVisible();

    expect(within(proposal).getByText('org/frontend:src/user.ts')).toBeVisible();
    expect(within(plan).getByText('Add a null guard')).not.toBeVisible();
    expect(
      within(rootCause).getByText(
        'The handler accessed the user without checking for null.'
      )
    ).not.toBeVisible();

    expect(within(proposal).getByText('org/backend:tests/test_user.py')).toBeVisible();

    await userEvent.click(
      within(plan).getByRole('button', {name: 'Implementation Plan'})
    );
    expect(within(plan).getByText('Add a null guard')).toBeVisible();
    expect(
      within(plan).getByText('Return a not-found response when the lookup has no user.')
    ).toBeVisible();
    expect(within(plan).getByText('Cover the missing-user path')).toBeVisible();

    await userEvent.click(within(rootCause).getByRole('button', {name: 'Root Cause'}));
    expect(
      within(rootCause).getByText(
        'The handler accessed the user without checking for null.'
      )
    ).toBeVisible();
    expect(
      within(rootCause).getByText('Request a user ID that does not exist.')
    ).toBeVisible();
  });

  it('renders only completed valid artifacts that exist in a partial run', () => {
    render(
      <IssuePreviewAutofixSummary
        autofix={ExplorerAutofixFixture({
          runState: ExplorerAutofixStateFixture({
            blocks: [ExplorerAutofixBlockFixture({artifacts: [rootCauseArtifact]})],
          }),
        })}
        groupId="preview-group"
      />
    );

    expect(screen.getByRole('region', {name: 'Root Cause'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Root Cause'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(
      screen.queryByRole('region', {name: 'Implementation Plan'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('region', {name: 'Code Changes'})).not.toBeInTheDocument();
  });

  it('renders progress messages with a loading indicator while processing', () => {
    render(
      <IssuePreviewAutofixSummary
        autofix={ExplorerAutofixFixture({
          runState: ExplorerAutofixStateFixture({
            blocks: [
              ExplorerAutofixBlockFixture({
                artifacts: undefined,
                message: {
                  content: 'Start the root cause analysis',
                  metadata: {step: 'root_cause'},
                  role: 'user',
                },
              }),
              ExplorerAutofixBlockFixture({
                id: 'progress',
                artifacts: undefined,
                message: {
                  content: 'Tracing the failing request...',
                  role: 'assistant',
                },
              }),
              ExplorerAutofixBlockFixture({
                id: 'thinking',
                artifacts: undefined,
                message: {
                  content: 'Thinking...',
                  thinking_content: 'Inspecting the event context...',
                  role: 'assistant',
                },
              }),
            ],
            status: 'processing',
          }),
        })}
        groupId="preview-group"
      />
    );

    const rootCause = screen.getByRole('region', {name: 'Root Cause'});
    expect(within(rootCause).getByText('Generating root cause...')).toBeInTheDocument();
    expect(within(rootCause).getByText('Inspecting the event context...')).toBeVisible();
    expect(within(rootCause).getByText('Tracing the failing request...')).toBeVisible();
    expect(within(rootCause).queryByText('Thinking...')).not.toBeInTheDocument();
    expect(
      within(rootCause).queryByText('Start the root cause analysis')
    ).not.toBeInTheDocument();
    expect(within(rootCause).getByTestId('loading-indicator')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', {name: 'Implementation Plan'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('region', {name: 'Code Changes'})).not.toBeInTheDocument();
  });

  it('renders progress messages only from the current PR iteration', () => {
    render(
      <IssuePreviewAutofixSummary
        autofix={ExplorerAutofixFixture({
          runState: ExplorerAutofixStateFixture({
            blocks: [
              ExplorerAutofixBlockFixture({
                id: 'code-changes-start',
                artifacts: undefined,
                message: {
                  content: 'Generate the initial code changes',
                  metadata: {step: 'code_changes'},
                  role: 'user',
                },
              }),
              ExplorerAutofixBlockFixture({
                id: 'initial-progress',
                artifacts: undefined,
                message: {
                  content: 'Editing the initial implementation...',
                  role: 'assistant',
                },
              }),
              ExplorerAutofixBlockFixture({
                id: 'first-iteration-start',
                artifacts: undefined,
                message: {
                  content: 'Address the first review',
                  metadata: {step: 'pr_iteration', iteration_index: '0'},
                  role: 'user',
                },
              }),
              ExplorerAutofixBlockFixture({
                id: 'first-iteration-progress',
                artifacts: undefined,
                message: {
                  content: 'Applying the first review...',
                  role: 'assistant',
                },
              }),
              ExplorerAutofixBlockFixture({
                id: 'second-iteration-start',
                artifacts: undefined,
                message: {
                  content: 'Address the second review',
                  metadata: {step: 'pr_iteration', iteration_index: '1'},
                  role: 'user',
                },
              }),
              ExplorerAutofixBlockFixture({
                id: 'second-iteration-progress',
                artifacts: undefined,
                message: {
                  content: 'Thinking...',
                  role: 'assistant',
                  thinking_content: 'Applying the second review...',
                },
              }),
            ],
            status: 'processing',
          }),
        })}
        groupId="preview-group"
      />
    );

    const proposal = screen.getByRole('region', {name: 'Code Changes'});
    expect(within(proposal).getByText('Applying the second review...')).toBeVisible();
    expect(
      within(proposal).queryByText('Editing the initial implementation...')
    ).not.toBeInTheDocument();
    expect(
      within(proposal).queryByText('Applying the first review...')
    ).not.toBeInTheDocument();
  });

  it.each([
    [
      'errored step',
      ExplorerAutofixStateFixture({
        blocks: [ExplorerAutofixBlockFixture({artifacts: [rootCauseArtifact]})],
        status: 'error',
      }),
    ],
    [
      'invalid artifact',
      ExplorerAutofixStateFixture({
        blocks: [
          ExplorerAutofixBlockFixture({
            artifacts: [
              AutofixRootCauseArtifactFixture({
                reason: 'Malformed root cause',
                data: {one_line_description: 'Missing required details'},
              }),
            ],
          }),
        ],
      }),
    ],
  ])('renders an empty section for a %s', (_label, runState) => {
    render(
      <IssuePreviewAutofixSummary
        autofix={ExplorerAutofixFixture({runState})}
        groupId="preview-group"
      />
    );

    expect(screen.queryByRole('region', {name: 'Code Changes'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', {name: 'Implementation Plan'})
    ).not.toBeInTheDocument();
    const rootCause = screen.getByRole('region', {name: 'Root Cause'});
    expect(
      within(rootCause).getByText('No root cause was identified.')
    ).toBeInTheDocument();
  });

  it('renders an existing section with empty text when it has no artifact', () => {
    render(
      <IssuePreviewAutofixSummary
        autofix={ExplorerAutofixFixture({
          runState: ExplorerAutofixStateFixture({
            blocks: [
              ExplorerAutofixBlockFixture({artifacts: [rootCauseArtifact]}),
              ExplorerAutofixBlockFixture({
                id: 'solution',
                artifacts: [
                  AutofixSolutionArtifactFixture({
                    reason: 'Malformed plan',
                    data: {one_line_summary: 'Missing steps'},
                  }),
                ],
                message: {
                  content: 'Plan complete',
                  metadata: {step: 'solution'},
                  role: 'assistant',
                },
              }),
            ],
          }),
        })}
        groupId="preview-group"
      />
    );

    expect(screen.getByRole('region', {name: 'Root Cause'})).toBeInTheDocument();
    const plan = screen.getByRole('region', {name: 'Implementation Plan'});
    expect(
      within(plan).getByText('No implementation plan was generated.')
    ).toBeInTheDocument();
  });

  it('re-runs a section from its disclosure action', async () => {
    const runState = ExplorerAutofixStateFixture({
      blocks: [ExplorerAutofixBlockFixture({artifacts: [rootCauseArtifact]})],
    });
    const autofix = ExplorerAutofixFixture({runState});

    render(<IssuePreviewAutofixSummary autofix={autofix} groupId="preview-group" />);

    const rootCause = screen.getByRole('region', {name: 'Root Cause'});
    const summary = within(rootCause).getByText(
      'An unexpected null value reached the user handler.'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Re-run step'}));
    expect(
      within(rootCause).getByText('How can this root cause be improved?')
    ).toBeInTheDocument();
    expect(
      within(rootCause)
        .getByText('How can this root cause be improved?')
        .compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    await userEvent.type(screen.getByRole('textbox'), 'Try again');
    await userEvent.click(screen.getByRole('button', {name: 'Re-run from here'}));

    expect(autofix.startStep).toHaveBeenCalledWith('root_cause', {
      runId: runState.run_id,
      userContext: 'Try again',
      insertIndex: 0,
    });
  });

  it('copies a completed section as markdown', async () => {
    render(
      <IssuePreviewAutofixSummary
        autofix={ExplorerAutofixFixture({
          runState: ExplorerAutofixStateFixture({
            blocks: [ExplorerAutofixBlockFixture({artifacts: [rootCauseArtifact]})],
          }),
        })}
        groupId="preview-group"
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Copy as Markdown'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      '# Root Cause\n\nAn unexpected null value reached the user handler.\n\n## Why did this happen?\n\n- The handler accessed the user without checking for null.\n- The upstream lookup can return no user.\n\n## Reproduction Steps\n\n1. Request a user ID that does not exist.'
    );
  });
});
