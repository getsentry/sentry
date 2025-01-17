import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {CommitRow} from 'sentry/components/commitRow';
import type {Commit, Repository} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';
import type {User} from 'sentry/types/user';

jest.mock('sentry/components/hovercard', () => {
  return {
    Header: ({children}: {children: React.ReactNode}) => children,
    Body: ({children}: {children: React.ReactNode}) => children,
    Hovercard: ({body}: any) => {
      return body;
    },
  };
});

jest.mock('sentry/actionCreators/modal', () => {
  return {
    ...jest.requireActual('sentry/actionCreators/modal'),
    openInviteMembersModal: jest.fn(),
  };
});

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

// static/app/components/hovercard.tsx
describe('commitRow', () => {
  it('renders custom avatar', () => {
    render(<CommitRow commit={baseCommit} customAvatar="Custom Avatar" />);
    expect(screen.getByText(/Custom Avatar/)).toBeInTheDocument();
  });

  it('renders invite flow for non associated users', async () => {
    const commit: Commit = {
      ...baseCommit,
      author: {
        ...baseCommit.author,
        id: undefined as unknown as string,
      },
    } as Commit;

    render(<CommitRow commit={commit} />);
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          /The email author@commit.com is not a member of your organization./
        )
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByText(/Invite/));

    // @ts-expect-error we are mocking this import
    expect(openInviteMembersModal.mock.calls[0][0].initialData[0].emails).toEqual(
      new Set(['author@commit.com'])
    );
  });

  it('renders commit info', () => {
    const commit: Commit = {
      ...baseCommit,
      author: {
        ...baseCommit.author,
        id: '0' as unknown as string,
      },
    } as Commit;

    render(<CommitRow commit={commit} />);

    expect(screen.getByText(/ref\(commitRow\): refactor to fc/)).toBeInTheDocument();
  });

  it('renders pull request', async () => {
    const commit: Commit = {
      ...baseCommit,
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

    const handlePullRequestClick = jest.fn();
    render(<CommitRow commit={commit} onPullRequestClick={handlePullRequestClick} />);

    const pullRequestButton = screen.getByRole('button', {name: 'View Pull Request'});
    expect(pullRequestButton).toBeInTheDocument();
    expect(pullRequestButton).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/pull/1'
    );

    await userEvent.click(pullRequestButton);
    expect(handlePullRequestClick).toHaveBeenCalledTimes(1);
  });
});
