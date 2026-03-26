import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CodingAgentProvider} from 'sentry/components/events/autofix/types';
import type {
  AutofixSection,
  RootCauseArtifact,
  SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {
  Artifact,
  ExplorerCodingAgentState,
  ExplorerFilePatch,
  RepoPRState,
} from 'sentry/views/seerExplorer/types';

import {
  CodeChangesPreview,
  CodingAgentPreview,
  PullRequestsPreview,
  RootCausePreview,
  SolutionPreview,
} from './autofixPreviews';

function makeSection(
  step: string,
  artifacts: any[] = [],
  {status}: {status: 'completed' | 'processing'} = {status: 'completed'}
): AutofixSection {
  return {step, artifacts, messages: [], status};
}

describe('RootCausePreview', () => {
  it('renders root cause title and description', () => {
    const artifact: Artifact<RootCauseArtifact> = {
      key: 'root-cause',
      reason: 'Found root cause',
      data: {
        one_line_description: 'Null pointer in user handler',
        five_whys: ['why1', 'why2'],
        reproduction_steps: ['step1'],
      },
    };

    render(<RootCausePreview section={makeSection('root_cause', [artifact])} />);

    expect(screen.getByText('Root Cause')).toBeInTheDocument();
    expect(screen.getByText('Null pointer in user handler')).toBeInTheDocument();
  });

  it('renders placeholder when processing', () => {
    render(
      <RootCausePreview section={makeSection('root_cause', [], {status: 'processing'})} />
    );

    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
  });

  it('handles null data', () => {
    const artifact: Artifact<RootCauseArtifact> = {
      key: 'root-cause',
      reason: 'No data',
      data: null,
    };

    render(<RootCausePreview section={makeSection('root_cause', [artifact])} />);

    expect(screen.getByText('Root Cause')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Seer failed to generate a root cause. This one is on us. Try running it again.'
      )
    ).toBeInTheDocument();
  });
});

describe('SolutionPreview', () => {
  it('renders plan title and summary', () => {
    const artifact: Artifact<SolutionArtifact> = {
      key: 'solution',
      reason: 'Found solution',
      data: {
        one_line_summary: 'Add null check before accessing user',
        steps: [{title: 'Step 1', description: 'Add guard'}],
      },
    };

    render(<SolutionPreview section={makeSection('solution', [artifact])} />);

    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Add null check before accessing user')).toBeInTheDocument();
  });

  it('renders placeholder when processing', () => {
    render(
      <SolutionPreview section={makeSection('solution', [], {status: 'processing'})} />
    );

    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
  });

  it('handles null data', () => {
    const artifact: Artifact<SolutionArtifact> = {
      key: 'solution',
      reason: 'No data',
      data: null,
    };

    render(<SolutionPreview section={makeSection('solution', [artifact])} />);

    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Seer failed to generate a plan. This one is on us. Try running it again.'
      )
    ).toBeInTheDocument();
  });
});

describe('CodeChangesPreview', () => {
  function makePatch(repoName: string, path: string): ExplorerFilePatch {
    return {
      repo_name: repoName,
      diff: '',
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

  it('renders single file in single repo', () => {
    render(
      <CodeChangesPreview
        section={makeSection('code_changes', [[makePatch('org/repo', 'src/app.py')]])}
      />
    );

    expect(screen.getByText('Code Changes')).toBeInTheDocument();
    expect(screen.getByText('1 file changed in 1 repo')).toBeInTheDocument();
  });

  it('renders multiple files in single repo', () => {
    render(
      <CodeChangesPreview
        section={makeSection('code_changes', [
          [
            makePatch('org/repo', 'src/app.py'),
            makePatch('org/repo', 'src/utils.py'),
            makePatch('org/repo', 'src/models.py'),
          ],
        ])}
      />
    );

    expect(screen.getByText('3 files changed in 1 repo')).toBeInTheDocument();
  });

  it('renders multiple files in multiple repos', () => {
    render(
      <CodeChangesPreview
        section={makeSection('code_changes', [
          [
            makePatch('org/repo-a', 'src/app.py'),
            makePatch('org/repo-a', 'src/utils.py'),
            makePatch('org/repo-b', 'src/index.ts'),
          ],
        ])}
      />
    );

    expect(screen.getByText('3 files changed in 2 repos')).toBeInTheDocument();
  });

  it('renders placeholder when processing', () => {
    render(
      <CodeChangesPreview
        section={makeSection('code_changes', [], {status: 'processing'})}
      />
    );

    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
  });

  it('renders empty array with error message', () => {
    render(<CodeChangesPreview section={makeSection('code_changes', [])} />);

    expect(screen.getByText('Code Changes')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Seer failed to generate a code change. This one is on us. Try running it again.'
      )
    ).toBeInTheDocument();
  });
});

describe('PullRequestsPreview', () => {
  function makePR(overrides: Partial<RepoPRState> = {}): RepoPRState {
    return {
      repo_name: 'org/repo',
      pr_number: 42,
      pr_url: 'https://github.com/org/repo/pull/42',
      branch_name: 'fix/issue',
      commit_sha: 'abc123',
      pr_creation_error: null,
      pr_creation_status: 'completed',
      pr_id: 1,
      title: 'Fix issue',
      ...overrides,
    };
  }

  it('renders PR links', () => {
    render(<PullRequestsPreview section={makeSection('pull_request', [[makePR()]])} />);

    expect(screen.getByText('Pull Requests')).toBeInTheDocument();
    const link = screen.getByRole('link', {name: 'org/repo#42'});
    expect(link).toHaveAttribute('href', 'https://github.com/org/repo/pull/42');
  });

  it('renders multiple PRs', () => {
    render(
      <PullRequestsPreview
        section={makeSection('pull_request', [
          [
            makePR({
              repo_name: 'org/repo-a',
              pr_number: 10,
              pr_url: 'https://pr/10',
            }),
            makePR({
              repo_name: 'org/repo-b',
              pr_number: 20,
              pr_url: 'https://pr/20',
            }),
          ],
        ])}
      />
    );

    expect(screen.getByRole('link', {name: 'org/repo-a#10'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'org/repo-b#20'})).toBeInTheDocument();
  });

  it('renders creating status with placeholder', () => {
    render(
      <PullRequestsPreview
        section={makeSection('pull_request', [
          [
            makePR({
              pr_creation_status: 'creating',
              pr_url: null,
              pr_number: null,
            }),
          ],
        ])}
      />
    );

    expect(screen.getByText('Pull Requests')).toBeInTheDocument();
    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
  });

  it('renders error status as failed', () => {
    render(
      <PullRequestsPreview
        section={makeSection('pull_request', [
          [
            makePR({
              pr_creation_status: 'error',
              pr_url: null,
              pr_number: null,
              repo_name: 'org/my-repo',
            }),
          ],
        ])}
      />
    );

    expect(screen.getByText('Failed to create PR in org/my-repo')).toBeInTheDocument();
  });

  it('renders failed message for completed PRs with missing fields', () => {
    render(
      <PullRequestsPreview
        section={makeSection('pull_request', [
          [
            makePR({
              repo_name: 'org/repo-a',
              pr_url: null,
              pr_creation_status: 'completed',
            }),
            makePR({
              repo_name: 'org/repo-b',
              pr_number: null,
              pr_creation_status: 'completed',
            }),
            makePR({
              repo_name: 'org/valid',
              pr_number: 55,
              pr_url: 'https://pr/55',
            }),
          ],
        ])}
      />
    );

    expect(screen.getByRole('link', {name: 'org/valid#55'})).toBeInTheDocument();
    // PRs with completed status but missing url/number now show failed message
    expect(screen.getAllByText(/Failed to create PR/)).toHaveLength(2);
  });
});

function makeCodingAgent(
  overrides: Partial<ExplorerCodingAgentState> = {}
): ExplorerCodingAgentState {
  return {
    id: 'agent-1',
    name: 'My Agent Task',
    provider: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
    started_at: '2026-01-01T00:00:00Z',
    status: 'running',
    ...overrides,
  };
}

describe('CodingAgentPreview', () => {
  it('renders provider-specific title for Cursor', () => {
    render(
      <CodingAgentPreview
        section={makeSection('coding_agents', [
          [
            makeCodingAgent({
              provider: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
            }),
          ],
        ])}
      />
    );

    expect(screen.getByText('Cursor Cloud Agent')).toBeInTheDocument();
  });

  it('renders provider-specific title for Claude', () => {
    render(
      <CodingAgentPreview
        section={makeSection('coding_agents', [
          [
            makeCodingAgent({
              provider: CodingAgentProvider.CLAUDE_CODE_AGENT,
            }),
          ],
        ])}
      />
    );

    expect(screen.getByText('Claude Agent')).toBeInTheDocument();
  });

  it('renders provider-specific title for GitHub Copilot', () => {
    render(
      <CodingAgentPreview
        section={makeSection('coding_agents', [
          [
            makeCodingAgent({
              provider: CodingAgentProvider.GITHUB_COPILOT_AGENT,
            }),
          ],
        ])}
      />
    );

    expect(screen.getByText('GitHub Copilot')).toBeInTheDocument();
  });

  it('renders default title for unknown provider', () => {
    render(
      <CodingAgentPreview
        section={makeSection('coding_agents', [
          [makeCodingAgent({provider: 'unknown' as any})],
        ])}
      />
    );

    expect(screen.getByText('Coding Agent')).toBeInTheDocument();
  });

  it('renders agent name and status tag', () => {
    render(
      <CodingAgentPreview
        section={makeSection('coding_agents', [
          [makeCodingAgent({name: 'Fix auth bug', status: 'completed'})],
        ])}
      />
    );

    expect(screen.getByText('Fix auth bug')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('renders "Open in Agent" link when agent_url present', () => {
    render(
      <CodingAgentPreview
        section={makeSection('coding_agents', [
          [makeCodingAgent({agent_url: 'https://cursor.com/agent/1'})],
        ])}
      />
    );

    const link = screen.getByRole('button', {name: 'Open in Agent'});
    expect(link).toHaveAttribute('href', 'https://cursor.com/agent/1');
  });

  it('does not render "Open in Agent" link when agent_url is absent', () => {
    render(
      <CodingAgentPreview section={makeSection('coding_agents', [[makeCodingAgent()]])} />
    );

    expect(screen.queryByRole('button', {name: 'Open in Agent'})).not.toBeInTheDocument();
  });

  it('renders pending status tag', () => {
    render(
      <CodingAgentPreview
        section={makeSection('coding_agents', [
          [makeCodingAgent({name: 'Pending Task', status: 'pending'})],
        ])}
      />
    );

    expect(screen.getByText('Pending Task')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('renders failed status tag', () => {
    render(
      <CodingAgentPreview
        section={makeSection('coding_agents', [
          [makeCodingAgent({name: 'Failed Task', status: 'failed'})],
        ])}
      />
    );

    expect(screen.getByText('Failed Task')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('handles multiple agents', () => {
    render(
      <CodingAgentPreview
        section={makeSection('coding_agents', [
          [
            makeCodingAgent({id: 'a1', name: 'Agent One', status: 'running'}),
            makeCodingAgent({
              id: 'a2',
              name: 'Agent Two',
              status: 'completed',
            }),
          ],
        ])}
      />
    );

    expect(screen.getByText('Agent One')).toBeInTheDocument();
    expect(screen.getByText('Agent Two')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });
});
// trivial change for CI testing
