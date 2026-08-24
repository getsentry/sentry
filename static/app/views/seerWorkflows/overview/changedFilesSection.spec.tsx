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
      renderDiff: () => null,
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
  it('renders every file without a toggle when there are 3 or fewer', () => {
    render(<Wrapper group={groupFixture(3)} />);

    expect(screen.getByText('src/file-0.py')).toBeInTheDocument();
    expect(screen.getByText('src/file-2.py')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /more file/i})).not.toBeInTheDocument();
  });

  it('shows only the first 3 files and a toggle when there are more', () => {
    render(<Wrapper group={groupFixture(5)} />);

    expect(screen.getByText('src/file-0.py')).toBeInTheDocument();
    expect(screen.getByText('src/file-2.py')).toBeInTheDocument();
    expect(screen.queryByText('src/file-3.py')).not.toBeInTheDocument();
    expect(screen.queryByText('src/file-4.py')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: /show 2 more files/i})).toBeInTheDocument();
  });

  it('reveals the remaining files and flips the label when toggled', async () => {
    render(<Wrapper group={groupFixture(5)} />);

    await userEvent.click(screen.getByRole('button', {name: /show 2 more files/i}));

    expect(screen.getByText('src/file-3.py')).toBeInTheDocument();
    expect(screen.getByText('src/file-4.py')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /show fewer/i})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /show fewer/i}));

    expect(screen.queryByText('src/file-3.py')).not.toBeInTheDocument();
  });
});
