import * as React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {CommitRow} from 'sentry/components/commitRow';
import {Commit, Repository, User} from 'sentry/types';

jest.mock('sentry/components/hovercard', () => {
  return {
    __esModule: true,
    default: ({body}) => {
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

const getByTextContent = text => {
  // Passing function to `getByText`
  return screen.getByText((_, element): boolean => {
    const hasText = (e: Element | null) => e?.textContent?.includes(text);
    const elementHasText = hasText(element);
    // We need to look at the children of the element to see if they have the text
    // eslint-disable-next-line
    const childrenDontHaveText = Array.from(element?.children || []).every(
      child => !hasText(child)
    );
    return !!(elementHasText && childrenDontHaveText);
  });
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

    mountWithTheme(<CommitRow commit={commit} />);
    expect(
      getByTextContent(
        'The email author@commit.com is not a member of your organization.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/is not a member of your organization./)).toBeInTheDocument();

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
