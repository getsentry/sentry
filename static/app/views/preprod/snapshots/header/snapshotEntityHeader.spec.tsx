import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';

import {SnapshotEntityHeader} from './snapshotEntityHeader';

const data = {
  head_artifact_id: '123',
  project_id: '456',
  app_id: 'sentry-frontend',
  comparison_type: 'diff',
  comparison_state: 'success',
  approval_status: 'requires_approval',
  approvers: [],
  base_artifact_id: null,
  image_count: 0,
  state: 'processed',
  vcs_info: {
    provider: 'github',
    head_repo_name: 'getsentry/sentry',
    head_ref: 'seer/spans-table',
    head_sha: '169d99deadbeef',
    pr_number: 125782,
  },
} as unknown as SnapshotDetailsApiResponse;

function renderHeader(overrides: Partial<SnapshotDetailsApiResponse> = {}) {
  return render(<SnapshotEntityHeader data={{...data, ...overrides}} />);
}

describe('SnapshotEntityHeader title', () => {
  it('links the branch out to its pull request', () => {
    renderHeader();

    const link = screen.getByRole('link', {name: 'Branch, seer/spans-table'});
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/pull/125782'
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(
      within(link).getByRole('heading', {level: 2, name: 'Branch, seer/spans-table'})
    ).toBeVisible();
  });

  it('falls back to the branch itself when there is no pull request', () => {
    renderHeader({
      vcs_info: {
        provider: 'github',
        head_repo_name: 'getsentry/sentry',
        head_ref: 'seer/spans-table',
        head_sha: '169d99deadbeef',
      },
    });

    expect(screen.getByRole('link', {name: 'Branch, seer/spans-table'})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/tree/seer/spans-table'
    );
  });

  it('renders the branch as text when the repository is unknown', () => {
    renderHeader({vcs_info: {head_ref: 'seer/spans-table'}});

    expect(
      screen.getByRole('heading', {level: 2, name: 'Branch, seer/spans-table'})
    ).toBeVisible();
    expect(
      screen.queryByRole('link', {name: /seer\/spans-table/})
    ).not.toBeInTheDocument();
  });

  it('falls back to the app when there is no commit comparison', () => {
    renderHeader({vcs_info: {}});

    expect(
      screen.getByRole('heading', {level: 2, name: 'App, sentry-frontend'})
    ).toBeVisible();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('falls back to a literal when there is no branch and no app', () => {
    renderHeader({vcs_info: {}, app_id: null});

    expect(
      screen.getByRole('heading', {level: 2, name: 'Snapshot, Unknown snapshot'})
    ).toBeVisible();
  });

  it('keeps the heading while loading', () => {
    render(<SnapshotEntityHeader data={undefined} />);

    expect(screen.getByRole('heading', {level: 2})).toBeInTheDocument();
  });
});

describe('SnapshotEntityHeader metadata', () => {
  it('renders the pull request then the commit', () => {
    renderHeader();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('#125782');
    expect(items[1]).toHaveTextContent('169d99d');
  });

  it('leaves the pull request as text, so the title is the only way to it', () => {
    renderHeader();

    const [prItem] = screen.getAllByRole('listitem');
    expect(prItem).toHaveTextContent('#125782');
    expect(within(prItem!).queryByRole('link')).not.toBeInTheDocument();

    const prLinks = screen
      .getAllByRole('link')
      .filter(link => link.getAttribute('href')?.includes('/pull/125782'));
    expect(prLinks).toHaveLength(1);
    expect(prLinks[0]).toHaveAccessibleName('Branch, seer/spans-table');
  });

  it('links the commit out to the repository', () => {
    renderHeader();

    const commit = screen.getByRole('link', {name: 'Commit 169d99d'});
    expect(commit).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/commit/169d99deadbeef'
    );
    expect(commit).toHaveAttribute('target', '_blank');
  });

  it('drops the pull request when the build has none', () => {
    renderHeader({
      vcs_info: {
        provider: 'github',
        head_repo_name: 'getsentry/sentry',
        head_ref: 'seer/spans-table',
        head_sha: '169d99deadbeef',
      },
    });

    expect(screen.queryByText(/#125782/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Commit 169d99d'})).toBeInTheDocument();
  });

  it('does not repeat the app id in the row', () => {
    renderHeader();

    const items = screen.getAllByRole('listitem');
    items.forEach(item => expect(item).not.toHaveTextContent('sentry-frontend'));
  });
});

describe('SnapshotEntityHeader approval', () => {
  it('shows a needs-approval tag while approval is required', () => {
    renderHeader();

    expect(screen.getByText('Needs approval')).toBeInTheDocument();
  });

  it('shows an approved tag once approved', () => {
    renderHeader({approval_status: 'approved'});

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByText('Needs approval')).not.toBeInTheDocument();
  });

  it('shows Approved instead of Failed once force approved', () => {
    renderHeader({comparison_state: 'failed', approval_status: 'approved'});

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
  });

  it('names the approvers in the tag tooltip', async () => {
    renderHeader({
      approval_status: 'approved',
      approvers: [
        {source: 'sentry', name: 'Alice Chen', approved_at: '2026-10-13T09:00:00Z'},
      ],
    });

    await userEvent.hover(screen.getByText('Approved'));

    expect(await screen.findByText('Alice Chen')).toBeInTheDocument();
  });

  it('explains an auto-approval in the tag tooltip', async () => {
    renderHeader({approval_status: 'auto_approved'});

    await userEvent.hover(screen.getByText('Auto-approved'));

    expect(
      await screen.findByText(/previously approved build on this PR/)
    ).toBeInTheDocument();
  });
});
