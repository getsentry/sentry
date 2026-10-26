import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  ChangedFilesSection,
  type RepoFileGroup,
  useExpandedKeys,
} from 'sentry/views/seerWorkflows/overview/changedFilesSection';

function groupFixture(fileCount: number): RepoFileGroup {
  return {
    repoName: 'getsentry/sentry',
    files: Array.from({length: fileCount}, (_, i) => ({
      additions: 1,
      deletions: 1,
      path: `src/file-${i}.py`,
      changeTag: null,
      renderDiff: () => <div>{`diff-${i}`}</div>,
    })),
  };
}

function Wrapper({group}: {group: RepoFileGroup}) {
  const {expandedKeys, toggle} = useExpandedKeys();
  return (
    <ChangedFilesSection groups={[group]} expandedKeys={expandedKeys} onToggle={toggle} />
  );
}

describe('ChangedFilesSection', () => {
  it('renders every file without a toggle when there are 5 or fewer', () => {
    render(<Wrapper group={groupFixture(5)} />);

    expect(screen.getByText('src/file-0.py')).toBeInTheDocument();
    expect(screen.getByText('src/file-4.py')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /more file/i})).not.toBeInTheDocument();
  });

  it('shows only the first 5 files and a toggle when there are more', () => {
    render(<Wrapper group={groupFixture(7)} />);

    expect(screen.getByText('src/file-0.py')).toBeInTheDocument();
    expect(screen.getByText('src/file-4.py')).toBeInTheDocument();
    expect(screen.queryByText('src/file-5.py')).not.toBeInTheDocument();
    expect(screen.queryByText('src/file-6.py')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: /show 2 more files/i})).toBeInTheDocument();
  });

  it('reveals the remaining files and flips the label when toggled', async () => {
    render(<Wrapper group={groupFixture(7)} />);

    await userEvent.click(screen.getByRole('button', {name: /show 2 more files/i}));

    expect(screen.getByText('src/file-5.py')).toBeInTheDocument();
    expect(screen.getByText('src/file-6.py')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /show fewer/i})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /show fewer/i}));

    expect(screen.queryByText('src/file-5.py')).not.toBeInTheDocument();
  });

  it('collapses an expanded diff when its file is hidden and re-revealed', async () => {
    render(<Wrapper group={groupFixture(7)} />);

    await userEvent.click(screen.getByRole('button', {name: /show 2 more files/i}));
    await userEvent.click(screen.getByRole('button', {name: /src\/file-6\.py/}));
    expect(screen.getByText('diff-6')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /show fewer/i}));
    await userEvent.click(screen.getByRole('button', {name: /show 2 more files/i}));

    expect(screen.getByText('src/file-6.py')).toBeInTheDocument();
    expect(screen.queryByText('diff-6')).not.toBeInTheDocument();
  });
});
