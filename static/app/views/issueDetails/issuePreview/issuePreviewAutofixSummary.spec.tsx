import {
  AutofixRepoPRStateFixture,
  AutofixRootCauseArtifactFixture,
  AutofixSolutionArtifactFixture,
  ExplorerAutofixBlockFixture,
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
  it('renders summaries in the requested order with the first section expanded', async () => {
    const runState = ExplorerAutofixStateFixture({
      blocks: [
        ExplorerAutofixBlockFixture({
          artifacts: [rootCauseArtifact],
          message: {
            content: 'Root cause complete',
            metadata: {step: 'root_cause'},
            role: 'assistant',
            tool_calls: [{id: 'event-tool', function: 'get_event_details', args: '{}'}],
          },
          tool_results: [
            {
              tool_call_id: 'event-tool',
              tool_call_function: 'get_event_details',
              content: 'Event details',
            },
          ],
          tool_links: [
            {
              kind: 'get_event_details',
              params: {issue_id: '12345', event_id: 'abcd1234efgh5678'},
            },
          ],
        }),
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

    render(<IssuePreviewAutofixSummary groupId="preview-group" runState={runState} />);

    expect(
      screen.getAllByRole('heading', {level: 3}).map(heading => heading.textContent)
    ).toEqual(['Proposal', 'Implementation Plan', 'Root Cause']);

    const proposal = screen.getByRole('region', {name: 'Proposal'});
    const plan = screen.getByRole('region', {name: 'Implementation Plan'});
    const rootCause = screen.getByRole('region', {name: 'Root Cause'});

    expect(within(proposal).getByRole('button', {name: 'Proposal'})).toHaveAttribute(
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
    expect(within(rootCause).getByText('Evidence')).toBeVisible();
    expect(within(rootCause).getByText('Error: abcd1234')).toBeVisible();
  });

  it('renders only completed valid artifacts that exist in a partial run', () => {
    render(
      <IssuePreviewAutofixSummary
        groupId="preview-group"
        runState={ExplorerAutofixStateFixture({
          blocks: [ExplorerAutofixBlockFixture({artifacts: [rootCauseArtifact]})],
        })}
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
    expect(screen.queryByRole('region', {name: 'Proposal'})).not.toBeInTheDocument();
  });

  it('renders the section with a loading indicator while it is processing', () => {
    render(
      <IssuePreviewAutofixSummary
        groupId="preview-group"
        runState={ExplorerAutofixStateFixture({
          blocks: [
            ExplorerAutofixBlockFixture({
              artifacts: undefined,
              message: {
                content: 'Thinking...',
                metadata: {step: 'root_cause'},
                role: 'assistant',
              },
            }),
          ],
          status: 'processing',
        })}
      />
    );

    const rootCause = screen.getByRole('region', {name: 'Root Cause'});
    expect(within(rootCause).getByText('Generating root cause...')).toBeInTheDocument();
    expect(within(rootCause).getByTestId('loading-indicator')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', {name: 'Implementation Plan'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('region', {name: 'Proposal'})).not.toBeInTheDocument();
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
  ])('renders nothing for a %s', (_label, runState) => {
    render(<IssuePreviewAutofixSummary groupId="preview-group" runState={runState} />);

    expect(screen.queryByRole('region', {name: 'Proposal'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', {name: 'Implementation Plan'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('region', {name: 'Root Cause'})).not.toBeInTheDocument();
  });
});
