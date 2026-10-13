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

// Every status is always rendered and the inactive ones hidden with CSS, which
// jsdom's getComputedStyle does not resolve, so read the emotion rule instead.
function getStatusLayerVisibility(text: string) {
  const layer = screen.getByText(text).parentElement!;
  return Array.from(document.styleSheets)
    .flatMap(sheet => Array.from(sheet.cssRules))
    .filter(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule && layer.matches(rule.selectorText)
    )
    .map(rule => rule.style.visibility)
    .findLast(Boolean);
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

  it('shows a push failure for a pull request that already exists', () => {
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

    expect(getStatusLayerVisibility('Could not push changes')).toBe('visible');
    expect(getStatusLayerVisibility('Could not open PR')).toBe('hidden');
    expect(screen.getByRole('link', {name: 'acme/web#482'})).toHaveAttribute(
      'href',
      PR_URL
    );
  });

  it('does not link a javascript: PR URL', () => {
    // oxlint-disable-next-line no-script-url
    const scriptUrl = 'javascript:alert(document.domain)';
    render(<PRLinksBar repoPRStates={{[REPO]: makeState({pr_url: scriptUrl})}} />);

    expect(screen.getByText('acme/web#482')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View PR'})).not.toHaveAttribute(
      'href',
      scriptUrl
    );
  });

  it('collapses the pull requests', async () => {
    render(<PRLinksBar repoPRStates={{[REPO]: makeState()}} />);

    await userEvent.click(screen.getByRole('button', {name: 'Pull requests (1)'}));
    expect(screen.queryByText(REPO)).not.toBeInTheDocument();
  });
});
