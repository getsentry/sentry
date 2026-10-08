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

    expect(screen.getByRole('button', {name: 'acme/web#482'})).toHaveAttribute(
      'href',
      PR_URL
    );
  });

  it('disables the button while the pull request is opening', async () => {
    render(
      <PRLinksBar
        repoPRStates={{
          [REPO]: makeState({
            pr_creation_status: 'creating',
            pr_number: null,
            pr_url: null,
          }),
        }}
      />
    );

    const button = screen.getByRole('button', {name: REPO});
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.hover(button);
    expect(await screen.findByText('Opening PR…')).toBeInTheDocument();
  });

  it('disables the button while changes are pushed to an open pull request', async () => {
    render(
      <PRLinksBar repoPRStates={{[REPO]: makeState({pr_creation_status: 'creating'})}} />
    );

    const button = screen.getByRole('button', {name: 'acme/web#482'});
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toHaveAttribute('href');
    await userEvent.hover(button);
    expect(await screen.findByText('Pushing changes…')).toBeInTheDocument();
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

    const button = screen.getByRole('button', {name: REPO});
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.hover(button);
    expect(await screen.findByText('No write access to repository')).toBeInTheDocument();
  });

  it('still links a pull request whose push failed', async () => {
    render(
      <PRLinksBar
        repoPRStates={{
          [REPO]: makeState({
            pr_creation_status: 'error',
            pr_creation_error: 'Push rejected',
          }),
        }}
      />
    );

    const button = screen.getByRole('button', {name: 'acme/web#482'});
    expect(button).toHaveAttribute('href', PR_URL);
    await userEvent.hover(button);
    expect(await screen.findByText('Push rejected')).toBeInTheDocument();
  });

  it('skips repos with no pull request', () => {
    render(<PRLinksBar repoPRStates={{[REPO]: makeState({pr_creation_status: null})}} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
