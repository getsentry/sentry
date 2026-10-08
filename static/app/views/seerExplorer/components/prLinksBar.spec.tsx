import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PRLinksBar} from 'sentry/views/seerExplorer/components/prLinksBar';
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

describe('PRLinksBar', () => {
  it('links a completed pull request', () => {
    render(<PRLinksBar repoPRStates={{[REPO]: makeState()}} />);

    expect(screen.getByRole('button', {name: 'View PR'})).toHaveAttribute('href', PR_URL);
    expect(screen.getByRole('link', {name: 'acme/web#482'})).toHaveAttribute(
      'href',
      PR_URL
    );
  });

  it('links an open pull request while changes are pushed to it', () => {
    render(
      <PRLinksBar repoPRStates={{[REPO]: makeState({pr_creation_status: 'creating'})}} />
    );

    expect(screen.getByText('Pushing changes…')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'acme/web#482'})).toHaveAttribute(
      'href',
      PR_URL
    );
  });

  it('shows the error when the pull request could not be opened', async () => {
    render(
      <PRLinksBar
        repoPRStates={{
          [REPO]: makeState({
            pr_creation_status: 'error',
            pr_creation_error: 'No write access to repository',
            pr_number: null,
            pr_url: null,
          }),
        }}
      />
    );

    await userEvent.hover(screen.getByText('Could not open PR'));
    expect(await screen.findByText('No write access to repository')).toBeInTheDocument();
  });

  it('collapses the pull requests', async () => {
    render(<PRLinksBar repoPRStates={{[REPO]: makeState()}} />);

    await userEvent.click(screen.getByRole('button', {name: 'Pull requests (1)'}));
    expect(screen.queryByText(REPO)).not.toBeInTheDocument();
  });
});
