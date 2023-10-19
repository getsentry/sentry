import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Commit, Repository, RepositoryStatus, User} from 'sentry/types';

import {QuickContextCommitRow} from './quickContextCommitRow';

const defaultCommit: Commit = {
  dateCreated: '2020-11-30T18:46:31Z',
  id: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
  message: 'feat(quick-context-commit-row): Added new component\n',
  author: {
    id: '0',
    username: 'abdKhan',
    ip_address: '192.168.1.1',
    email: 'abd@commit.com',
    name: 'Abdullah Khan ',
  } as User,
  repository: {
    id: '1',
    integrationId: '2',
    name: 'getsentry/sentry',
    dateCreated: '2019-11-30T18:46:31Z',
  } as Repository,
  releases: [],
};

describe('Quick Context Commit Row', () => {
  it('Renders author name specific avatar', () => {
    render(<QuickContextCommitRow commit={defaultCommit} />);
    expect(screen.getByText(/AK/i)).toBeInTheDocument();
  });

  it('Renders commit link text with no PR', () => {
    render(<QuickContextCommitRow commit={defaultCommit} />);

    expect(
      screen.getByTestId('quick-context-commit-row-commit-link')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('quick-context-commit-row-pr-link')
    ).not.toBeInTheDocument();
    expect(screen.getByText(/View commit/i)).toBeInTheDocument();
    expect(screen.getByText(/f7f395d/i)).toBeInTheDocument();
    expect(screen.getByText(/by/i)).toBeInTheDocument();
    expect(screen.getByText(/Abdullah Khan/i)).toBeInTheDocument();
  });

  it('Renders pull request link', () => {
    const commit: Commit = {
      ...defaultCommit,
      pullRequest: {
        id: '9',
        title: 'cool pr',
        externalUrl: 'https://github.com/getsentry/sentry/pull/1',
        repository: {
          id: '14',
          name: 'example',
          url: '',
          provider: {
            id: 'unknown',
            name: 'Unknown Provider',
          },
          status: RepositoryStatus.ACTIVE,
          dateCreated: '2022-10-07T19:35:27.370422Z',
          integrationId: '14',
          externalSlug: 'org-slug',
          externalId: '1',
        },
      },
    };

    render(<QuickContextCommitRow commit={commit} />);

    const pullRequestLink = screen.getByText(
      /feat\(quick-context-commit-row\): Added new component/
    );
    expect(screen.queryByTestId('quick-context-commit-row-pr-link')).toBeInTheDocument();
    expect(pullRequestLink).toBeInTheDocument();
    expect(pullRequestLink).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/pull/1'
    );
    expect(
      screen.getByTestId('quick-context-commit-row-commit-link')
    ).toBeInTheDocument();
  });
});
