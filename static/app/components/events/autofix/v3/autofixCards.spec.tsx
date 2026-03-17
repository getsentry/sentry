import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {
  AutofixArtifact,
  AutofixSection,
  RootCauseArtifact,
  SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {ExplorerFilePatch, RepoPRState} from 'sentry/views/seerExplorer/types';

import {
  CodeChangesCard,
  PullRequestsCard,
  RootCauseCard,
  SolutionCard,
} from './autofixCards';

jest.mock('sentry/views/seerExplorer/fileDiffViewer', () => ({
  FileDiffViewer: () => <div data-testid="file-diff-viewer" />,
}));

function makeSection(
  step: string,
  status: AutofixSection['status'],
  artifacts: AutofixArtifact[]
): AutofixSection {
  return {step, artifacts, messages: [], status};
}

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

const mockAutofix = {
  runState: null,
  isLoading: false,
  isPolling: false,
  startStep: jest.fn(),
  createPR: jest.fn(),
  reset: jest.fn(),
  triggerCodingAgentHandoff: jest.fn(),
};

function makeRootCauseArtifact(data: RootCauseArtifact | null) {
  return {
    key: 'root-cause',
    reason: 'Found root cause',
    data,
  };
}

function makeSolutionArtifact(data: SolutionArtifact | null) {
  return {
    key: 'solution',
    reason: 'Found solution',
    data,
  };
}

describe('RootCauseCard', () => {
  it('renders title and one_line_description summary', () => {
    const artifact = makeRootCauseArtifact({
      one_line_description: 'Null pointer in user handler',
      five_whys: ['why1', 'why2'],
      reproduction_steps: ['step1'],
    });

    render(
      <RootCauseCard
        autofix={mockAutofix}
        section={makeSection('root_cause', 'completed', [artifact])}
      />
    );

    expect(screen.getByText('Root Cause')).toBeInTheDocument();
    expect(screen.getByText('Null pointer in user handler')).toBeInTheDocument();
  });

  it('renders five_whys list items and heading', () => {
    const artifact = makeRootCauseArtifact({
      one_line_description: 'Bug',
      five_whys: ['First why', 'Second why', 'Third why'],
    });

    render(
      <RootCauseCard
        autofix={mockAutofix}
        section={makeSection('root_cause', 'completed', [artifact])}
      />
    );

    expect(screen.getByText('Why did this happen?')).toBeInTheDocument();
    expect(screen.getByText('First why')).toBeInTheDocument();
    expect(screen.getByText('Second why')).toBeInTheDocument();
    expect(screen.getByText('Third why')).toBeInTheDocument();
  });

  it('renders reproduction_steps when present', () => {
    const artifact = makeRootCauseArtifact({
      one_line_description: 'Bug',
      five_whys: ['why1'],
      reproduction_steps: ['Open the page', 'Click button'],
    });

    render(
      <RootCauseCard
        autofix={mockAutofix}
        section={makeSection('root_cause', 'completed', [artifact])}
      />
    );

    expect(screen.getByText('Reproduction Steps')).toBeInTheDocument();
    expect(screen.getByText('Open the page')).toBeInTheDocument();
    expect(screen.getByText('Click button')).toBeInTheDocument();
  });

  it('renders card shell when artifact data is null', () => {
    const artifact = makeRootCauseArtifact(null);

    render(
      <RootCauseCard
        autofix={mockAutofix}
        section={makeSection('root_cause', 'completed', [artifact])}
      />
    );

    expect(screen.getByText('Root Cause')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Seer failed to generate a root cause. This one is on us. Try running it again.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Re-run'})).toBeInTheDocument();
  });

  it('handles empty five_whys with placeholder', () => {
    const artifact = makeRootCauseArtifact({
      one_line_description: 'Bug',
      five_whys: [],
    });

    render(
      <RootCauseCard
        autofix={mockAutofix}
        section={makeSection('root_cause', 'completed', [artifact])}
      />
    );

    expect(screen.getByText('Root Cause')).toBeInTheDocument();
    expect(screen.queryByText('Why did this happen?')).not.toBeInTheDocument();
  });
});

describe('SolutionCard', () => {
  it('renders title and one_line_summary', () => {
    const artifact = makeSolutionArtifact({
      one_line_summary: 'Add null check before accessing user',
      steps: [{title: 'Step 1', description: 'Add guard'}],
    });

    render(
      <SolutionCard
        autofix={mockAutofix}
        section={makeSection('solution', 'completed', [artifact])}
      />
    );

    expect(screen.getByText('Implementation Plan')).toBeInTheDocument();
    expect(screen.getByText('Add null check before accessing user')).toBeInTheDocument();
  });

  it('renders steps with title and description', () => {
    const artifact = makeSolutionArtifact({
      one_line_summary: 'Fix the bug',
      steps: [
        {title: 'Add validation', description: 'Check input is not null'},
        {title: 'Update handler', description: 'Handle edge case'},
      ],
    });

    render(
      <SolutionCard
        autofix={mockAutofix}
        section={makeSection('solution', 'completed', [artifact])}
      />
    );

    expect(screen.getByText('Steps to Resolve')).toBeInTheDocument();
    expect(screen.getByText('Add validation')).toBeInTheDocument();
    expect(screen.getByText('Check input is not null')).toBeInTheDocument();
    expect(screen.getByText('Update handler')).toBeInTheDocument();
    expect(screen.getByText('Handle edge case')).toBeInTheDocument();
  });

  it('renders card shell when artifact data is null', () => {
    const artifact = makeSolutionArtifact(null);

    render(
      <SolutionCard
        autofix={mockAutofix}
        section={makeSection('solution', 'completed', [artifact])}
      />
    );

    expect(screen.getByText('Implementation Plan')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Seer failed to generate an implementation plan. This one is on us. Try running it again.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Re-run'})).toBeInTheDocument();
  });
});

describe('CodeChangesCard', () => {
  it('renders single file in single repo', () => {
    render(
      <CodeChangesCard
        autofix={mockAutofix}
        section={makeSection('code_changes', 'completed', [
          [makePatch('org/repo', 'src/app.py')],
        ])}
      />
    );

    expect(screen.getByText('Code Changes')).toBeInTheDocument();
    expect(screen.getByText('1 file changed in 1 repo')).toBeInTheDocument();
  });

  it('renders multiple files in single repo', () => {
    render(
      <CodeChangesCard
        autofix={mockAutofix}
        section={makeSection('code_changes', 'completed', [
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
      <CodeChangesCard
        autofix={mockAutofix}
        section={makeSection('code_changes', 'completed', [
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

  it('renders repository name labels', () => {
    render(
      <CodeChangesCard
        autofix={mockAutofix}
        section={makeSection('code_changes', 'completed', [
          [
            makePatch('org/repo-a', 'src/app.py'),
            makePatch('org/repo-b', 'src/index.ts'),
          ],
        ])}
      />
    );

    expect(screen.getByText('org/repo-a')).toBeInTheDocument();
    expect(screen.getByText('org/repo-b')).toBeInTheDocument();
  });

  it('renders card shell when no code changes artifact found', () => {
    render(
      <CodeChangesCard
        autofix={mockAutofix}
        section={makeSection('code_changes', 'completed', [])}
      />
    );

    expect(screen.getByText('Code Changes')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Seer failed to generate a code change. This one is on us. Try running it again.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Re-run'})).toBeInTheDocument();
  });
});

describe('PullRequestsCard', () => {
  it('renders PR link buttons with correct text and href', () => {
    render(
      <PullRequestsCard
        autofix={mockAutofix}
        section={makeSection('pull_request', 'completed', [[makePR()]])}
      />
    );

    expect(screen.getByText('Pull Requests')).toBeInTheDocument();
    const button = screen.getByRole('button', {
      name: 'View PR#42 in org/repo',
    });
    expect(button).toHaveAttribute('href', 'https://github.com/org/repo/pull/42');
  });

  it('renders multiple PR buttons', () => {
    render(
      <PullRequestsCard
        autofix={mockAutofix}
        section={makeSection('pull_request', 'completed', [
          [
            makePR({repo_name: 'org/repo-a', pr_number: 10, pr_url: 'https://pr/10'}),
            makePR({repo_name: 'org/repo-b', pr_number: 20, pr_url: 'https://pr/20'}),
          ],
        ])}
      />
    );

    expect(
      screen.getByRole('button', {name: 'View PR#10 in org/repo-a'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'View PR#20 in org/repo-b'})
    ).toBeInTheDocument();
  });

  it('skips PRs with missing pr_url or pr_number', () => {
    render(
      <PullRequestsCard
        autofix={mockAutofix}
        section={makeSection('pull_request', 'completed', [
          [
            makePR({repo_name: 'org/repo-a', pr_url: null}),
            makePR({repo_name: 'org/repo-b', pr_number: null}),
            makePR({
              repo_name: 'org/valid',
              pr_number: 55,
              pr_url: 'https://pr/55',
            }),
          ],
        ])}
      />
    );

    expect(screen.getByRole('button', {name: /View PR#/})).toHaveAttribute(
      'href',
      'https://pr/55'
    );
  });
});

describe('ArtifactCard expand/collapse', () => {
  it('children are visible by default', () => {
    const artifact = makeRootCauseArtifact({
      one_line_description: 'Bug',
      five_whys: ['Visible why'],
    });

    render(
      <RootCauseCard
        autofix={mockAutofix}
        section={makeSection('root_cause', 'completed', [artifact])}
      />
    );

    expect(screen.getByText('Visible why')).toBeInTheDocument();
  });

  it('clicking collapse button hides children', async () => {
    const artifact = makeRootCauseArtifact({
      one_line_description: 'Bug',
      five_whys: ['Hidden why'],
    });

    render(
      <RootCauseCard
        autofix={mockAutofix}
        section={makeSection('root_cause', 'completed', [artifact])}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Root Cause'}));

    expect(screen.queryByText('Bug')).not.toBeVisible();
    expect(screen.queryByText('Hidden why')).not.toBeVisible();
  });

  it('clicking again re-shows children', async () => {
    const artifact = makeRootCauseArtifact({
      one_line_description: 'Bug',
      five_whys: ['Toggle why'],
    });

    render(
      <RootCauseCard
        autofix={mockAutofix}
        section={makeSection('root_cause', 'completed', [artifact])}
      />
    );

    expect(screen.getByText('Bug')).toBeVisible();
    expect(screen.getByText('Toggle why')).toBeVisible();

    await userEvent.click(screen.getByRole('button', {name: 'Root Cause'}));
    expect(screen.queryByText('Bug')).not.toBeVisible();
    expect(screen.queryByText('Toggle why')).not.toBeVisible();

    await userEvent.click(screen.getByRole('button', {name: 'Root Cause'}));
    expect(screen.getByText('Bug')).toBeVisible();
    expect(screen.getByText('Toggle why')).toBeVisible();
  });
});
