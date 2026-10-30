import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DiffFileType, DiffLineType} from 'sentry/components/events/autofix/types';
import {RunChangesView} from 'sentry/views/seerExplorer/components/runChangesView';
import type {ChangeSet, RepoChanges} from 'sentry/views/seerExplorer/runChanges';
import type {ExplorerFilePatch, RepoPRState} from 'sentry/views/seerExplorer/types';

const REPO = 'acme/web';

const prState: RepoPRState = {
  repo_name: REPO,
  branch_name: 'seer/add-cart-logging',
  commit_sha: 'abc123',
  pr_creation_error: null,
  pr_creation_status: 'completed',
  pr_id: 999,
  pr_number: 482,
  pr_url: 'https://github.com/acme/web/pull/482',
  title: 'Add cart total logging',
};

/** A patch that replaces one line of `path` with `added`. */
function filePatch(path: string, added: string): ExplorerFilePatch {
  return {
    repo_name: REPO,
    diff: '',
    patch: {
      path,
      source_file: path,
      target_file: path,
      type: DiffFileType.MODIFIED,
      added: 1,
      removed: 1,
      hunks: [
        {
          section_header: '',
          source_start: 1,
          source_length: 1,
          target_start: 1,
          target_length: 1,
          lines: [
            {
              diff_line_no: null,
              line_type: DiffLineType.REMOVED,
              source_line_no: 1,
              target_line_no: null,
              value: 'old\n',
            },
            {
              diff_line_no: null,
              line_type: DiffLineType.ADDED,
              source_line_no: null,
              target_line_no: 1,
              value: `${added}\n`,
            },
          ],
        },
      ],
    },
  };
}

function changeSet(files: ExplorerFilePatch[]): ChangeSet {
  return {files, added: files.length, removed: files.length};
}

function makeChanges(overrides: Partial<RepoChanges> = {}): RepoChanges {
  return {
    repoName: REPO,
    prState,
    allStatus: 'success',
    all: changeSet([
      filePatch('app/cart.py', 'cart on the PR'),
      filePatch('app/money.py', 'money from the base'),
    ]),
    unpushed: changeSet([filePatch('app/money.py', 'money since the push')]),
    ...overrides,
  };
}

describe('RunChangesView', () => {
  it('shows every change', () => {
    render(<RunChangesView changes={makeChanges()} onBack={jest.fn()} />);

    expect(screen.getByText('acme/web#482')).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'All changes'})).toBeChecked();
    expect(screen.getByText('cart on the PR')).toBeInTheDocument();
    expect(screen.getByText('money from the base')).toBeInTheDocument();
  });

  it('shows only the unpushed changes when toggled', async () => {
    render(<RunChangesView changes={makeChanges()} onBack={jest.fn()} />);

    await userEvent.click(screen.getByRole('radio', {name: 'Unpushed'}));

    expect(screen.getByText('money since the push')).toBeInTheDocument();
    expect(screen.queryByText('cart on the PR')).not.toBeInTheDocument();
  });

  it('cannot show unpushed changes once everything is pushed', () => {
    render(
      <RunChangesView
        changes={makeChanges({unpushed: changeSet([])})}
        onBack={jest.fn()}
      />
    );

    expect(screen.getByRole('radio', {name: 'Unpushed'})).toBeDisabled();
  });

  it("says when the PR's changes can't load", () => {
    render(
      <RunChangesView
        changes={makeChanges({all: null, allStatus: 'error'})}
        onBack={jest.fn()}
      />
    );

    expect(screen.getByText("Couldn't load the PR's changes.")).toBeInTheDocument();
  });

  it("can show the unpushed changes while the PR's changes load", async () => {
    render(
      <RunChangesView
        changes={makeChanges({all: null, allStatus: 'pending'})}
        onBack={jest.fn()}
      />
    );

    expect(screen.queryByText('cart on the PR')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'Unpushed'}));

    expect(screen.getByText('money since the push')).toBeInTheDocument();
  });

  it('shows the changes of a repo without a PR', () => {
    const files = changeSet([filePatch('app/cart.py', 'cart')]);
    render(
      <RunChangesView
        changes={makeChanges({prState: null, all: files, unpushed: files})}
        onBack={jest.fn()}
      />
    );

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByText('Not in a PR yet')).toBeInTheDocument();
    expect(screen.getByText('cart')).toBeInTheDocument();
  });

  it('explains the unpushed changes in a tooltip', async () => {
    render(<RunChangesView changes={makeChanges()} onBack={jest.fn()} />);

    await userEvent.hover(screen.getByRole('radio', {name: 'Unpushed'}));

    expect(
      await screen.findByText(/Changes Seer made after its last push/)
    ).toBeInTheDocument();
  });

  it('collapses and expands every file at once', async () => {
    render(<RunChangesView changes={makeChanges()} onBack={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', {name: 'Collapse all'}));

    expect(screen.queryByText('cart on the PR')).not.toBeInTheDocument();
    expect(screen.queryByText('money from the base')).not.toBeInTheDocument();

    // Expanding one file leaves the rest collapsed, so the toggle still offers to expand.
    await userEvent.click(screen.getByText('app/cart.py'));
    expect(screen.getByText('cart on the PR')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Expand all'}));

    expect(screen.getByText('money from the base')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Collapse all'})).toBeInTheDocument();
  });

  it('goes back with the back button or Escape', async () => {
    const onBack = jest.fn();
    render(<RunChangesView changes={makeChanges()} onBack={onBack} />);

    const back = screen.getByRole('button', {name: 'Back to chat'});
    expect(back).toHaveFocus();
    await userEvent.click(back);
    await userEvent.keyboard('{Escape}');

    expect(onBack).toHaveBeenCalledTimes(2);
  });
});
