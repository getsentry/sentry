import {render, screen} from '@testing-library/react';

import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {CommitRow} from 'sentry/components/commitRow';
import {Commit, Repository, User} from 'sentry/types';

const baseCommit: Commit = {
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
  } as Repository,
  releases: [],
};

describe('commitRow', () => {
  it('renders custom avatar', () => {
    render(<CommitRow commit={baseCommit} customAvatar="Custom Avatar" />);
    expect(screen.getByText(/Custom Avatar/)).toBeInTheDocument();
  });

  it('renders commit info', () => {
    const commit: Commit = {
      ...baseCommit,
      author: {
        ...baseCommit.author,
        id: '0' as unknown as string,
      },
    } as Commit;

    mountWithTheme(<CommitRow commit={commit} />);

    expect(screen.getByText(/ref\(commitRow\): refactor to fc/)).toBeInTheDocument();
  });
});
