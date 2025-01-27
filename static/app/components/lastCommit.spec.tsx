import {CommitFixture} from 'sentry-fixture/commit';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import LastCommit from 'sentry/components/lastCommit';

describe('LastCommit', function () {
  let mockedCommit!: ReturnType<typeof CommitFixture>;
  const mockedCommitTitle = '(improve) Add Links to Spike-Protection Email (#2408)';

  beforeEach(() => {
    mockedCommit = CommitFixture();
  });

  it('renders', function () {
    render(<LastCommit commit={mockedCommit} />);
  });

  it('links to the commit in GitHub', function () {
    mockedCommit.repository!.provider = {id: 'github', name: 'GitHub'};
    const mockedCommitURL = `${mockedCommit.repository?.url}/commit/${mockedCommit.id}`;

    render(<LastCommit commit={mockedCommit} />);
    expect(screen.getByText(mockedCommitTitle)).toBeInTheDocument();
    expect(screen.getByText(mockedCommitTitle)).toHaveAttribute('href', mockedCommitURL);
  });

  it('displays the commit with its shortened ID if it has no message', function () {
    mockedCommit.message = null;

    render(<LastCommit commit={mockedCommit} />);
    expect(screen.queryByText(mockedCommitTitle)).not.toBeInTheDocument();
    expect(screen.getByText(mockedCommit.id.slice(0, 7))).toBeInTheDocument();
  });
});
