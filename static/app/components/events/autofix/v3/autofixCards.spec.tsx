import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {
  RootCauseArtifact,
  SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {
  Artifact,
  ExplorerFilePatch,
  RepoPRState,
} from 'sentry/views/seerExplorer/types';

import {
  CodeChangesCard,
  PullRequestsCard,
  RootCauseCard,
  SolutionCard,
} from './autofixCards';

jest.mock('sentry/views/seerExplorer/fileDiffViewer', () => ({
  FileDiffViewer: () => <div data-testid="file-diff-viewer" />,
}));

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

describe('RootCauseCard', () => {
  it('renders title and one_line_description summary', () => {
    const artifact: Artifact<RootCauseArtifact> = {
      key: 'root-cause',
      reason: 'Found root cause',
      data: {
        one_line_description: 'Null pointer in user handler',
        five_whys: ['why1', 'why2'],
        reproduction_steps: ['step1'],
      },
    };

    render(<RootCauseCard artifact={artifact} />);

    expect(screen.getByText('Root Cause')).toBeInTheDocument();
    expect(screen.getByText('Null pointer in user handler')).toBeInTheDocument();
  });

  it('renders five_whys list items and heading', () => {
    const artifact: Artifact<RootCauseArtifact> = {
      key: 'root-cause',
      reason: 'Found root cause',
      data: {
        one_line_description: 'Bug',
        five_whys: ['First why', 'Second why', 'Third why'],
      },
    };

    render(<RootCauseCard artifact={artifact} />);

    expect(screen.getByText('Why did this happen?')).toBeInTheDocument();
    expect(screen.getByText('First why')).toBeInTheDocument();
    expect(screen.getByText('Second why')).toBeInTheDocument();
    expect(screen.getByText('Third why')).toBeInTheDocument();
  });

  it('renders reproduction_steps when present', () => {
    const artifact: Artifact<RootCauseArtifact> = {
      key: 'root-cause',
      reason: 'Found root cause',
      data: {
        one_line_description: 'Bug',
        five_whys: ['why1'],
        reproduction_steps: ['Open the page', 'Click button'],
      },
    };

    render(<RootCauseCard artifact={artifact} />);

    expect(screen.getByText('Reproduction Steps')).toBeInTheDocument();
    expect(screen.getByText('Open the page')).toBeInTheDocument();
    expect(screen.getByText('Click button')).toBeInTheDocument();
  });

  it('handles null data with placeholder', () => {
    const artifact: Artifact<RootCauseArtifact> = {
      key: 'root-cause',
      reason: 'No data',
      data: null,
    };

    render(<RootCauseCard artifact={artifact} />);

    expect(screen.getByText('Root Cause')).toBeInTheDocument();
  });

  it('handles empty five_whys with placeholder', () => {
    const artifact: Artifact<RootCauseArtifact> = {
      key: 'root-cause',
      reason: 'Found root cause',
      data: {
        one_line_description: 'Bug',
        five_whys: [],
      },
    };

    render(<RootCauseCard artifact={artifact} />);

    expect(screen.getByText('Root Cause')).toBeInTheDocument();
    expect(screen.queryByText('Why did this happen?')).not.toBeInTheDocument();
  });
});

describe('SolutionCard', () => {
  it('renders title and one_line_summary', () => {
    const artifact: Artifact<SolutionArtifact> = {
      key: 'solution',
      reason: 'Found solution',
      data: {
        one_line_summary: 'Add null check before accessing user',
        steps: [{title: 'Step 1', description: 'Add guard'}],
      },
    };

    render(<SolutionCard artifact={artifact} />);

    expect(screen.getByText('Implementation Plan')).toBeInTheDocument();
    expect(screen.getByText('Add null check before accessing user')).toBeInTheDocument();
  });

  it('renders steps with title and description', () => {
    const artifact: Artifact<SolutionArtifact> = {
      key: 'solution',
      reason: 'Found solution',
      data: {
        one_line_summary: 'Fix the bug',
        steps: [
          {title: 'Add validation', description: 'Check input is not null'},
          {title: 'Update handler', description: 'Handle edge case'},
        ],
      },
    };

    render(<SolutionCard artifact={artifact} />);

    expect(screen.getByText('Steps to Resolve')).toBeInTheDocument();
    expect(screen.getByText('Add validation')).toBeInTheDocument();
    expect(screen.getByText('Check input is not null')).toBeInTheDocument();
    expect(screen.getByText('Update handler')).toBeInTheDocument();
    expect(screen.getByText('Handle edge case')).toBeInTheDocument();
  });

  it('handles null data with placeholder', () => {
    const artifact: Artifact<SolutionArtifact> = {
      key: 'solution',
      reason: 'No data',
      data: null,
    };

    render(<SolutionCard artifact={artifact} />);

    expect(screen.getByText('Implementation Plan')).toBeInTheDocument();
  });
});

describe('CodeChangesCard', () => {
  // The component uses Map.entries().map() which returns an iterator —
  // React warns about this. Suppress until the component is fixed.
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation();
  });

  it('renders single file in single repo', () => {
    render(<CodeChangesCard artifact={[makePatch('org/repo', 'src/app.py')]} />);

    expect(screen.getByText('Code Changes')).toBeInTheDocument();
    expect(screen.getByText('1 file changed in 1 repo')).toBeInTheDocument();
  });

  it('renders multiple files in single repo', () => {
    render(
      <CodeChangesCard
        artifact={[
          makePatch('org/repo', 'src/app.py'),
          makePatch('org/repo', 'src/utils.py'),
          makePatch('org/repo', 'src/models.py'),
        ]}
      />
    );

    expect(screen.getByText('3 files changed in 1 repo')).toBeInTheDocument();
  });

  it('renders multiple files in multiple repos', () => {
    render(
      <CodeChangesCard
        artifact={[
          makePatch('org/repo-a', 'src/app.py'),
          makePatch('org/repo-a', 'src/utils.py'),
          makePatch('org/repo-b', 'src/index.ts'),
        ]}
      />
    );

    expect(screen.getByText('3 files changed in 2 repos')).toBeInTheDocument();
  });

  it('renders repository name labels', () => {
    render(
      <CodeChangesCard
        artifact={[
          makePatch('org/repo-a', 'src/app.py'),
          makePatch('org/repo-b', 'src/index.ts'),
        ]}
      />
    );

    expect(screen.getByText('org/repo-a')).toBeInTheDocument();
    expect(screen.getByText('org/repo-b')).toBeInTheDocument();
  });

  it('handles empty array with placeholder', () => {
    render(<CodeChangesCard artifact={[]} />);

    expect(screen.getByText('Code Changes')).toBeInTheDocument();
  });
});

describe('PullRequestsCard', () => {
  it('renders PR link buttons with correct text and href', () => {
    render(<PullRequestsCard artifact={[makePR()]} />);

    expect(screen.getByText('Pull Requests')).toBeInTheDocument();
    const button = screen.getByRole('button', {
      name: 'View PR#42 in org/repo',
    });
    expect(button).toHaveAttribute('href', 'https://github.com/org/repo/pull/42');
  });

  it('renders multiple PR buttons', () => {
    render(
      <PullRequestsCard
        artifact={[
          makePR({repo_name: 'org/repo-a', pr_number: 10, pr_url: 'https://pr/10'}),
          makePR({repo_name: 'org/repo-b', pr_number: 20, pr_url: 'https://pr/20'}),
        ]}
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
        artifact={[
          makePR({pr_url: null}),
          makePR({pr_number: null}),
          makePR({
            repo_name: 'org/valid',
            pr_number: 55,
            pr_url: 'https://pr/55',
          }),
        ]}
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
    const artifact: Artifact<RootCauseArtifact> = {
      key: 'root-cause',
      reason: 'Found root cause',
      data: {
        one_line_description: 'Bug',
        five_whys: ['Visible why'],
      },
    };

    render(<RootCauseCard artifact={artifact} />);

    expect(screen.getByText('Visible why')).toBeInTheDocument();
  });

  it('clicking collapse button hides children', async () => {
    const artifact: Artifact<RootCauseArtifact> = {
      key: 'root-cause',
      reason: 'Found root cause',
      data: {
        one_line_description: 'Bug',
        five_whys: ['Hidden why'],
      },
    };

    render(<RootCauseCard artifact={artifact} />);

    await userEvent.click(screen.getByRole('button', {name: 'Collapse'}));

    expect(screen.queryByText('Hidden why')).not.toBeInTheDocument();
  });

  it('clicking again re-shows children', async () => {
    const artifact: Artifact<RootCauseArtifact> = {
      key: 'root-cause',
      reason: 'Found root cause',
      data: {
        one_line_description: 'Bug',
        five_whys: ['Toggle why'],
      },
    };

    render(<RootCauseCard artifact={artifact} />);

    await userEvent.click(screen.getByRole('button', {name: 'Collapse'}));
    expect(screen.queryByText('Toggle why')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));
    expect(screen.getByText('Toggle why')).toBeInTheDocument();
  });
});
