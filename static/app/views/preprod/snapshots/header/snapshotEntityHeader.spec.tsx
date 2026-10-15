import {
  PreprodVcsInfoFullFixture,
  SnapshotApproverFixture,
  SnapshotDetailsFixture,
} from 'sentry-fixture/preprod';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';

import {SnapshotEntityHeader} from './snapshotEntityHeader';

const vcsInfo = PreprodVcsInfoFullFixture({
  provider: 'github',
  head_repo_name: 'getsentry/sentry',
  head_ref: 'seer/spans-table',
  head_sha: '169d99deadbeef',
  pr_number: 125782,
});

function renderHeader(overrides: Partial<SnapshotDetailsApiResponse> = {}) {
  return render(
    <SnapshotEntityHeader
      data={SnapshotDetailsFixture({vcs_info: vcsInfo, ...overrides})}
    />
  );
}

describe('SnapshotEntityHeader title', () => {
  it('names the app, as plain text', () => {
    renderHeader();

    expect(
      screen.getByRole('heading', {level: 2, name: 'App, sentry-frontend'})
    ).toBeVisible();
    expect(screen.queryByRole('link', {name: /sentry-frontend/})).not.toBeInTheDocument();
  });

  it('falls back to the same label the GitHub check uses', () => {
    renderHeader({app_id: null});

    expect(
      screen.getByRole('heading', {level: 2, name: 'App, Unknown App'})
    ).toBeVisible();
  });

  it('keeps the heading while loading', () => {
    render(<SnapshotEntityHeader data={undefined} />);

    expect(screen.getByRole('heading', {level: 2})).toBeInTheDocument();
  });
});

describe('SnapshotEntityHeader metadata', () => {
  it('renders the pull request, branch and commit in that order', () => {
    renderHeader();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('#125782');
    expect(items[1]).toHaveTextContent('seer/spans-table');
    expect(items[2]).toHaveTextContent('169d99d');
  });

  it('links the pull request out, and nothing else', () => {
    renderHeader();

    const pr = screen.getByRole('link', {name: 'Pull request #125782'});
    expect(pr).toHaveAttribute('href', 'https://github.com/getsentry/sentry/pull/125782');
    expect(pr).toHaveAttribute('target', '_blank');

    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('renders the pull request as text when it cannot be linked', () => {
    renderHeader({vcs_info: {pr_number: 125782}});

    expect(screen.getByText('#125782')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('drops each item the build has no data for', () => {
    renderHeader({vcs_info: {}});

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('SnapshotEntityHeader approval', () => {
  it('shows a needs-approval tag while approval is required', () => {
    renderHeader();

    expect(screen.getByText('Needs approval')).toBeInTheDocument();
  });

  it('shows Approved instead of Failed once force approved', () => {
    renderHeader({comparison_state: 'failed', approval_status: 'approved'});

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
  });

  it('explains an auto-approval', async () => {
    renderHeader({approval_status: 'auto_approved', approvers: []});

    await userEvent.hover(screen.getByText('Auto-approved'));

    expect(
      await screen.findByText(/previously approved build on this PR/)
    ).toBeInTheDocument();
  });
});

describe('SnapshotEntityHeader approvers', () => {
  it('names the approvers alongside the status, not inside it', () => {
    renderHeader({
      approval_status: 'approved',
      approvers: [
        SnapshotApproverFixture({name: 'Alice Chen'}),
        SnapshotApproverFixture({source: 'github', name: null, username: 'bob-lee'}),
      ],
    });

    expect(screen.getByText('Approved by: Alice Chen, bob-lee')).toBeInTheDocument();
  });

  it('names a GitHub approver by its login rather than as an unknown author', () => {
    renderHeader({
      approval_status: 'approved',
      approvers: [{source: 'github', username: 'bob-lee'}],
    });

    expect(screen.getByText('Approved by: bob-lee')).toBeInTheDocument();
  });

  it('still names them when the comparison never succeeded', () => {
    renderHeader({
      comparison_state: 'failed',
      approval_status: 'approved',
      approvers: [SnapshotApproverFixture({name: 'Alice Chen'})],
    });

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Approved by: Alice Chen')).toBeInTheDocument();
  });

  it('renders nothing when nobody has approved', () => {
    renderHeader();

    expect(screen.queryByText(/^Approved by:/)).not.toBeInTheDocument();
  });
});
