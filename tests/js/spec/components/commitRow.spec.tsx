import {fireEvent, mountWithTheme, render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {CommitRow} from 'sentry/components/commitRow';
import {Commit, Repository, User} from 'sentry/types';

jest.mock('sentry/components/hovercard', () => {
  return {
    Header: ({children}: {children: React.ReactNode}) => children,
    Body: ({children}: {children: React.ReactNode}) => children,
    Hovercard: ({body}) => {
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

  it('renders invite flow for non associated users', () => {
    const commit: Commit = {
      ...baseCommit,
      author: {
        ...baseCommit.author,
        id: undefined as unknown as string,
      },
    } as Commit;

    mountWithTheme(<CommitRow commit={commit} />);
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          /The email author@commit.com is not a member of your organization./
        )
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Invite/));

    // @ts-ignore we are mocking this import
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

    mountWithTheme(<CommitRow commit={commit} />);

    expect(screen.getByText(/ref\(commitRow\): refactor to fc/)).toBeInTheDocument();
  });
});
