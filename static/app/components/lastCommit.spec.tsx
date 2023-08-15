import {render, screen} from 'sentry-test/reactTestingLibrary';

import LastCommit from 'sentry/components/lastCommit';
import {Commit, Repository, User} from 'sentry/types';

describe('LastCommit', function () {
  const mockedCommit: Commit = {
    dateCreated: '2020-11-30T18:46:31Z',
    id: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
    message: 'ref(commitRow): refactor to fc\n',
    author: {
      id: '0',
      username: 'author',
      ip_address: '192.168.1.1',
      email: 'author@commit.com',
      name: 'Author',
    } as User,
    repository: {
      id: '1',
      integrationId: '2',
      name: 'getsentry/sentry',
      dateCreated: '2019-11-30T18:46:31Z',
      url: 'https://www.github.com/getsentry/sentry',
    } as Repository,
    releases: [],
  };

  it('renders', function () {
    const wrapper = render(<LastCommit commit={mockedCommit} />);

    expect(wrapper.container).toSnapshot();
  });

  it('links to the commit in GitHub', function () {
    const mockedCommitURL = mockedCommit.repository?.url + '/commit/' + mockedCommit.id;
    render(<LastCommit commit={mockedCommit} />);
    expect(screen.getByText('ref(commitRow): refactor to fc')).toHaveAttribute(
      'href',
      mockedCommitURL
    );
  });
});
