import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {SeerRepoPRStatesProvider} from 'sentry/components/seer/markdown/embeds/components/pullRequestRef';
import type {RepoPRState} from 'sentry/views/seerExplorer/types';

const REPO = 'acme/web';
const PR_URL = 'https://github.com/acme/web/pull/482';

function makeState(overrides: Partial<RepoPRState> = {}): RepoPRState {
  return {
    repo_name: REPO,
    branch_name: 'seer/add-cart-logging',
    commit_sha: 'abc123',
    pr_creation_error: null,
    pr_creation_status: 'completed',
    pr_id: 999,
    pr_number: 482,
    pr_url: PR_URL,
    title: 'Add cart total logging',
    ...overrides,
  };
}

function renderCard({
  states,
  body = {repoName: REPO, runId: 42},
}: {
  states: Record<string, RepoPRState> | null;
  body?: Record<string, unknown>;
}) {
  return render(
    <SeerRepoPRStatesProvider repoPRStates={states}>
      <SeerMarkdown
        raw="{% pullRequestRef /%}"
        structuredContent={{pullRequestRef: body}}
      />
    </SeerRepoPRStatesProvider>
  );
}

describe('pullRequestRef embed', () => {
  it('shows progress while the pull request is being opened', () => {
    renderCard({
      states: {
        [REPO]: makeState({
          pr_creation_status: 'creating',
          pr_number: null,
          pr_url: null,
        }),
      },
    });

    expect(screen.getByText(REPO)).toBeInTheDocument();
    expect(screen.getByText('Opening a pull request in acme/web…')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows progress against the existing pull request when pushing to one', () => {
    renderCard({
      states: {[REPO]: makeState({pr_creation_status: 'creating'})},
    });

    expect(screen.getByText('Pushing changes to acme/web#482…')).toBeInTheDocument();
  });

  it('links the pull request once the push completes', () => {
    renderCard({states: {[REPO]: makeState()}});

    const link = screen.getByRole('button', {name: 'View acme/web#482'});
    expect(link).toHaveAttribute('href', PR_URL);
    expect(screen.getByText('Add cart total logging')).toBeInTheDocument();
  });

  it('reports a failed push with the error Seer recorded', () => {
    renderCard({
      states: {
        [REPO]: makeState({
          pr_creation_status: 'error',
          pr_number: null,
          pr_url: null,
          pr_creation_error: 'No write access to repository',
        }),
      },
    });

    expect(screen.getByText('Seer could not push to acme/web.')).toBeInTheDocument();
    expect(screen.getByText('No write access to repository')).toBeInTheDocument();
  });

  it('falls back to the pull request pinned in the body when the host has no run state', () => {
    renderCard({
      states: null,
      body: {
        repoName: REPO,
        prNumber: 482,
        prUrl: PR_URL,
        title: 'Add cart total logging',
      },
    });

    expect(screen.getByRole('button', {name: 'View acme/web#482'})).toHaveAttribute(
      'href',
      PR_URL
    );
  });

  it('waits when neither the host nor the body knows the pull request yet', () => {
    renderCard({states: {}});

    expect(
      screen.getByText('Waiting for the pull request in acme/web…')
    ).toBeInTheDocument();
  });

  it('renders nothing for a body without a repository', () => {
    renderCard({states: {}, body: {runId: 42}});

    expect(screen.queryByTestId('pull-request-ref-embed')).not.toBeInTheDocument();
  });
});
