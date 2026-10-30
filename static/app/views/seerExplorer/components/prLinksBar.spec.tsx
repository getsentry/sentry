import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DiffFileType} from 'sentry/components/events/autofix/types';
import {PRLinksBar} from 'sentry/views/seerExplorer/components/prLinksBar';
import type {RepoChanges} from 'sentry/views/seerExplorer/runChanges';
import type {ExplorerFilePatch, RepoPRState} from 'sentry/views/seerExplorer/types';

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

function filePatch(path: string, added: number, removed: number): ExplorerFilePatch {
  return {
    repo_name: REPO,
    diff: '',
    patch: {
      path,
      source_file: path,
      target_file: path,
      type: DiffFileType.MODIFIED,
      added,
      removed,
      hunks: [],
    },
  };
}

function makeChanges(
  prState: RepoPRState | null,
  unpushed: ExplorerFilePatch[] = []
): RepoChanges {
  return {
    repoName: REPO,
    prState,
    allStatus: 'success',
    all: {added: 12, removed: 3, files: [filePatch('app/cart.py', 12, 3)]},
    unpushed: {
      added: unpushed.reduce((sum, file) => sum + file.patch.added, 0),
      removed: unpushed.reduce((sum, file) => sum + file.patch.removed, 0),
      files: unpushed,
    },
  };
}

describe('PRLinksBar', () => {
  it('links a completed pull request', () => {
    render(<PRLinksBar repoPRStates={{[REPO]: makeState()}} />);

    expect(screen.getByRole('link', {name: 'acme/web#482'})).toHaveAttribute(
      'href',
      PR_URL
    );
  });

  it('says when the pull request is opening', async () => {
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

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await userEvent.hover(screen.getByText(REPO));
    expect(await screen.findByText('Opening PR…')).toBeInTheDocument();
  });

  it('says when changes are being pushed to an open pull request', async () => {
    render(
      <PRLinksBar repoPRStates={{[REPO]: makeState({pr_creation_status: 'creating'})}} />
    );

    await userEvent.hover(screen.getByRole('link', {name: 'acme/web#482'}));
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

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await userEvent.hover(screen.getByText(REPO));
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

    const link = screen.getByRole('link', {name: 'acme/web#482'});
    expect(link).toHaveAttribute('href', PR_URL);
    await userEvent.hover(link);
    expect(await screen.findByText('Push rejected')).toBeInTheDocument();
  });

  it('says the push failed when a pull request already exists', async () => {
    render(
      <PRLinksBar
        repoPRStates={{
          [REPO]: makeState({pr_creation_status: 'error', pr_creation_error: null}),
        }}
      />
    );

    await userEvent.hover(screen.getByRole('link', {name: 'acme/web#482'}));
    expect(await screen.findByText('Could not push changes')).toBeInTheDocument();
  });

  it('does not link a javascript: PR URL', () => {
    // oxlint-disable-next-line no-script-url
    const scriptUrl = 'javascript:alert(document.domain)';
    render(<PRLinksBar repoPRStates={{[REPO]: makeState({pr_url: scriptUrl})}} />);

    expect(screen.getByText('acme/web#482')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('skips repos with no pull request', () => {
    render(<PRLinksBar repoPRStates={{[REPO]: makeState({pr_creation_status: null})}} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens the diff from the stats beside the PR', async () => {
    const state = makeState();
    const onOpenChanges = jest.fn();
    render(
      <PRLinksBar
        repoPRStates={{[REPO]: state}}
        changes={[makeChanges(state)]}
        onOpenChanges={onOpenChanges}
      />
    );

    expect(screen.getByRole('link', {name: 'acme/web#482'})).toHaveAttribute(
      'href',
      PR_URL
    );
    const changesButton = screen.getByRole('button', {name: 'View changes'});
    expect(changesButton).toHaveTextContent('+12-3');

    await userEvent.click(changesButton);

    expect(onOpenChanges).toHaveBeenCalledWith(REPO);
  });

  it('says how many files have changes not pushed to the PR', () => {
    const state = makeState();
    render(
      <PRLinksBar
        repoPRStates={{[REPO]: state}}
        changes={[makeChanges(state, [filePatch('app/cart.py', 1, 1)])]}
        onOpenChanges={jest.fn()}
      />
    );

    expect(
      screen.getByRole('button', {
        name: 'View changes. 1 file has changes not pushed to the PR.',
      })
    ).toBeInTheDocument();
  });

  it('opens the changes of a repo Seer has not opened a PR for', async () => {
    const onOpenChanges = jest.fn();
    render(
      <PRLinksBar
        repoPRStates={{}}
        changes={[makeChanges(null, [filePatch('app/cart.py', 12, 3)])]}
        onOpenChanges={onOpenChanges}
      />
    );

    // There's no PR to link to yet.
    expect(screen.getByText(REPO)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {name: 'View changes. 1 file is not in a PR yet.'})
    );

    expect(onOpenChanges).toHaveBeenCalledWith(REPO);
  });

  it('asks Seer to push its unpushed changes to the PR', async () => {
    const onPushChanges = jest.fn();
    render(
      <PRLinksBar
        repoPRStates={{[REPO]: makeState()}}
        changes={[makeChanges(makeState(), [filePatch('app/cart.py', 2, 0)])]}
        onPushChanges={onPushChanges}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Update PR'}));

    expect(onPushChanges).toHaveBeenCalledWith(
      'Push your latest changes to the acme/web PR.'
    );
  });

  it('asks Seer to open a PR when there is none', async () => {
    const onPushChanges = jest.fn();
    render(
      <PRLinksBar
        repoPRStates={{}}
        changes={[makeChanges(null, [filePatch('app/cart.py', 12, 3)])]}
        onPushChanges={onPushChanges}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Create PR'}));

    expect(onPushChanges).toHaveBeenCalledWith(
      'Open a PR in acme/web with your changes.'
    );
  });

  it('gives each repo its own push button', async () => {
    const onPushChanges = jest.fn();
    render(
      <PRLinksBar
        repoPRStates={{[REPO]: makeState()}}
        changes={[
          makeChanges(makeState(), [filePatch('app/cart.py', 2, 0)]),
          {
            ...makeChanges(null, [filePatch('app/api.py', 1, 0)]),
            repoName: 'acme/api',
          },
        ]}
        onOpenChanges={jest.fn()}
        onPushChanges={onPushChanges}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Update PR'}));
    await userEvent.click(screen.getByRole('button', {name: 'Create PR'}));

    expect(onPushChanges.mock.calls).toEqual([
      ['Push your latest changes to the acme/web PR.'],
      ['Open a PR in acme/api with your changes.'],
    ]);
  });

  it('disables pushing while Seer is working', async () => {
    render(
      <PRLinksBar
        repoPRStates={{[REPO]: makeState()}}
        changes={[makeChanges(makeState(), [filePatch('app/cart.py', 2, 0)])]}
        isAgentBusy
        onPushChanges={jest.fn()}
      />
    );

    const button = screen.getByRole('button', {name: 'Update PR'});
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.hover(button);
    expect(await screen.findByText('Seer is still working.')).toBeInTheDocument();
  });

  it('has nothing to push once every change is on the PR', () => {
    render(
      <PRLinksBar
        repoPRStates={{[REPO]: makeState()}}
        changes={[makeChanges(makeState())]}
        onPushChanges={jest.fn()}
      />
    );

    expect(screen.queryByRole('button', {name: 'Update PR'})).not.toBeInTheDocument();
  });
});
