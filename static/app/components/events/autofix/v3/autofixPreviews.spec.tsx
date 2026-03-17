import {render, screen} from 'sentry-test/reactTestingLibrary';

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
  CodeChangesPreview,
  PullRequestsPreview,
  RootCausePreview,
  SolutionPreview,
} from './autofixPreviews';

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

    render(<RootCausePreview artifact={artifact} />);

    expect(screen.getByText('Root Cause')).toBeInTheDocument();
    expect(screen.getByText('Null pointer in user handler')).toBeInTheDocument();
  });

  it('handles null data', () => {
    const artifact: Artifact<RootCauseArtifact> = {
      key: 'root-cause',
      reason: 'No data',
      data: null,
    };

    render(<RootCausePreview artifact={artifact} />);

    expect(screen.getByText('Root Cause')).toBeInTheDocument();
  });
});

describe('SolutionPreview', () => {
  it('renders implementation plan title and summary', () => {
    const artifact: Artifact<SolutionArtifact> = {
      key: 'solution',
      reason: 'Found solution',
      data: {
        one_line_summary: 'Add null check before accessing user',
        steps: [{title: 'Step 1', description: 'Add guard'}],
      },
    };

    render(<SolutionPreview artifact={artifact} />);

    expect(screen.getByText('Implementation Plan')).toBeInTheDocument();
    expect(screen.getByText('Add null check before accessing user')).toBeInTheDocument();
  });

  it('handles null data', () => {
    const artifact: Artifact<SolutionArtifact> = {
      key: 'solution',
      reason: 'No data',
      data: null,
    };

    render(<SolutionPreview artifact={artifact} />);

    expect(screen.getByText('Implementation Plan')).toBeInTheDocument();
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
    render(<CodeChangesPreview artifact={[makePatch('org/repo', 'src/app.py')]} />);

    expect(screen.getByText('Code Changes')).toBeInTheDocument();
    expect(screen.getByText('1 file changed in 1 repo')).toBeInTheDocument();
  });

  it('renders multiple files in single repo', () => {
    render(
      <CodeChangesPreview
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
      <CodeChangesPreview
        artifact={[
          makePatch('org/repo-a', 'src/app.py'),
          makePatch('org/repo-a', 'src/utils.py'),
          makePatch('org/repo-b', 'src/index.ts'),
        ]}
      />
    );

    expect(screen.getByText('3 files changed in 2 repos')).toBeInTheDocument();
  });

  it('renders empty array without file counts', () => {
    render(<CodeChangesPreview artifact={[]} />);

    expect(screen.getByText('Code Changes')).toBeInTheDocument();
    expect(screen.getByText('No files changed')).toBeInTheDocument();
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
    render(<PullRequestsPreview artifact={[makePR()]} />);

    expect(screen.getByText('Pull Requests')).toBeInTheDocument();
    const link = screen.getByRole('link', {name: 'org/repo#42'});
    expect(link).toHaveAttribute('href', 'https://github.com/org/repo/pull/42');
  });

  it('renders multiple PRs', () => {
    render(
      <PullRequestsPreview
        artifact={[
          makePR({repo_name: 'org/repo-a', pr_number: 10, pr_url: 'https://pr/10'}),
          makePR({repo_name: 'org/repo-b', pr_number: 20, pr_url: 'https://pr/20'}),
        ]}
      />
    );

    expect(screen.getByRole('link', {name: 'org/repo-a#10'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'org/repo-b#20'})).toBeInTheDocument();
  });

  it('skips PRs with missing fields', () => {
    render(
      <PullRequestsPreview
        artifact={[
          makePR({pr_url: null}),
          makePR({pr_number: null}),
          makePR({repo_name: '', pr_number: 99, pr_url: 'https://pr/99'}),
          makePR({
            repo_name: 'org/valid',
            pr_number: 55,
            pr_url: 'https://pr/55',
          }),
        ]}
      />
    );

    expect(screen.getByRole('link', {name: 'org/valid#55'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /repo#42/})).not.toBeInTheDocument();
  });
});
