import {Fragment, useState} from 'react';

import {
  act,
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {usePullRequestDiffs} from 'sentry/views/seerExplorer/hooks/usePullRequestDiffs';
import type {RepoPRState} from 'sentry/views/seerExplorer/types';

const REPO = 'getsentry/sentry';

const prState: RepoPRState = {
  repo_name: REPO,
  branch_name: 'seer/fix',
  commit_sha: 'abc123',
  pr_creation_error: null,
  pr_creation_status: 'completed',
  pr_id: '1',
  pr_number: 42,
  pr_url: 'https://github.com/getsentry/sentry/pull/42',
  title: 'Fix it',
};

describe('usePullRequestDiffs', () => {
  it("fetches each PR's files, and fetches them again after a push", async () => {
    const files = [
      {
        path: 'a.py',
        patch: '@@ -1 +1 @@\n-a\n+b',
        previousPath: null,
        status: 'modified',
      },
    ];
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/pull-request-files/',
      body: {files},
    });
    // State lives inside the hook: `rerender` would rebuild the test router.
    const {result} = renderHookWithProviders(() => {
      const [repoPRStates, setRepoPRStates] = useState<Record<string, RepoPRState>>({
        [REPO]: prState,
        'getsentry/no-pr': {...prState, repo_name: 'getsentry/no-pr', pr_number: null},
      });
      const diffs = usePullRequestDiffs({
        enabled: true,
        organizationSlug: 'org-slug',
        repoPRStates,
      });
      return {diffs, setRepoPRStates};
    });

    expect(result.current.diffs).toEqual({[REPO]: {status: 'pending'}});
    await waitFor(() =>
      expect(result.current.diffs).toEqual({[REPO]: {status: 'success', files}})
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      '/organizations/org-slug/repos/pull-request-files/',
      expect.objectContaining({query: {repo: REPO, number: 42, commit_sha: 'abc123'}})
    );

    act(() =>
      result.current.setRepoPRStates({[REPO]: {...prState, commit_sha: 'def456'}})
    );

    // The old diff lacks the pushed edits, so don't show it while the new one loads.
    expect(result.current.diffs).toEqual({[REPO]: {status: 'pending'}});
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(result.current.diffs).toEqual({[REPO]: {status: 'success', files}})
    );
  });

  it("doesn't show the old diff after a push made while unmounted", async () => {
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/pull-request-files/',
      body: {files: []},
    });
    function Diffs({commitSha}: {commitSha: string}) {
      const diffs = usePullRequestDiffs({
        enabled: true,
        organizationSlug: 'org-slug',
        repoPRStates: {[REPO]: {...prState, commit_sha: commitSha}},
      });
      return <div>{diffs[REPO]?.status}</div>;
    }
    // One render keeps one query client across the remount.
    function Panel() {
      const [commitSha, setCommitSha] = useState<string | null>('abc123');
      return (
        <Fragment>
          <button onClick={() => setCommitSha(null)}>Close</button>
          <button onClick={() => setCommitSha('def456')}>Reopen after a push</button>
          {commitSha && <Diffs commitSha={commitSha} />}
        </Fragment>
      );
    }
    render(<Panel />);
    expect(await screen.findByText('success')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Close'}));
    await userEvent.click(screen.getByRole('button', {name: 'Reopen after a push'}));

    // The diff cached before the push is still fresh, but lacks the pushed edits.
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/org-slug/repos/pull-request-files/',
      expect.objectContaining({query: {repo: REPO, number: 42, commit_sha: 'def456'}})
    );
  });

  it('reports a failed fetch', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/pull-request-files/',
      statusCode: 502,
      body: {detail: 'Failed to fetch pull request files.'},
    });

    const {result} = renderHookWithProviders(() =>
      usePullRequestDiffs({
        enabled: true,
        organizationSlug: 'org-slug',
        repoPRStates: {[REPO]: prState},
      })
    );

    await waitFor(() => expect(result.current).toEqual({[REPO]: {status: 'error'}}));
  });
});
