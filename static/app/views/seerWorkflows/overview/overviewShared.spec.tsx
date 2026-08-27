import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DiffFileType, type FilePatch} from 'sentry/components/events/autofix/types';

import {
  CodeChangesSummaryTag,
  ReviewPrStatusTags,
  summarizeCodeChanges,
} from './overviewShared';
import type {OverviewCodeChangeFile, OverviewPullRequest} from './types';

function codeChangeFixture(
  overrides: Partial<FilePatch> = {},
  repoName = 'getsentry/sentry'
): OverviewCodeChangeFile {
  return {
    repoName,
    patch: {
      path: 'src/foo.py',
      source_file: 'src/foo.py',
      target_file: 'src/foo.py',
      type: DiffFileType.MODIFIED,
      added: 3,
      removed: 1,
      hunks: [],
      ...overrides,
    },
  };
}

function pullRequestFixture(
  overrides: Partial<OverviewPullRequest> = {}
): OverviewPullRequest {
  return {
    id: '1',
    number: 1,
    url: 'https://github.com/getsentry/sentry/pull/1',
    status: 'open',
    checksStatus: null,
    reviewStatus: null,
    files: [],
    ...overrides,
  };
}

describe('summarizeCodeChanges', () => {
  it('counts distinct paths and sums additions/deletions', () => {
    expect(
      summarizeCodeChanges([
        codeChangeFixture({path: 'a.py', added: 8, removed: 2}),
        codeChangeFixture({path: 'b.py', added: 4, removed: 12}),
      ])
    ).toEqual({fileCount: 2, additions: 12, deletions: 14});
  });

  it('de-duplicates repeated paths across repos', () => {
    expect(
      summarizeCodeChanges([
        codeChangeFixture({path: 'a.py', added: 1, removed: 1}, 'repo-a'),
        codeChangeFixture({path: 'a.py', added: 2, removed: 3}, 'repo-b'),
      ])
    ).toEqual({fileCount: 1, additions: 3, deletions: 4});
  });

  it('handles an empty change set', () => {
    expect(summarizeCodeChanges([])).toEqual({
      fileCount: 0,
      additions: 0,
      deletions: 0,
    });
  });
});

describe('CodeChangesSummaryTag', () => {
  it('renders a file count with additions and deletions', () => {
    render(
      <CodeChangesSummaryTag
        codeChanges={[
          codeChangeFixture({path: 'a.py', added: 8, removed: 2}),
          codeChangeFixture({path: 'b.py', added: 4, removed: 12}),
        ]}
      />
    );

    expect(screen.getByText('2 files')).toBeInTheDocument();
    expect(screen.getByText('+12')).toBeInTheDocument();
    expect(screen.getByText('−14')).toBeInTheDocument();
  });

  it('renders singular file copy for one file', () => {
    render(<CodeChangesSummaryTag codeChanges={[codeChangeFixture()]} />);
    expect(screen.getByText('1 file')).toBeInTheDocument();
  });

  it('renders nothing when there are no changes', () => {
    const {container} = render(<CodeChangesSummaryTag codeChanges={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ReviewPrStatusTags', () => {
  it('renders review and checks status tags', () => {
    render(
      <ReviewPrStatusTags
        pullRequest={pullRequestFixture({
          checksStatus: 'success',
          reviewStatus: 'approved',
        })}
      />
    );

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Checks Passing')).toBeInTheDocument();
  });

  it('labels failing checks with their count', () => {
    render(
      <ReviewPrStatusTags
        pullRequest={pullRequestFixture({
          checksStatus: 'failure',
          reviewStatus: 'changes_requested',
          failedCheckDetails: [{name: 'lint', url: null}],
        })}
      />
    );

    expect(screen.getByText('Changes Requested')).toBeInTheDocument();
    expect(screen.getByText('1 Check Failing')).toBeInTheDocument();
  });

  it('renders nothing for an un-enriched PR', () => {
    const {container} = render(<ReviewPrStatusTags pullRequest={pullRequestFixture()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
