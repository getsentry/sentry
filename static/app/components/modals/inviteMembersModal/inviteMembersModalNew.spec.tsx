import type {ComponentProps} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import InviteMembersModalNew from 'sentry/components/modals/inviteMembersModal/inviteMembersModalNew';

describe('InviteMembersModalNew', function () {
  const modalProps: ComponentProps<typeof InviteMembersModalNew> = {
    canSend: true,
    complete: false,
    Header: makeClosableHeader(jest.fn()),
    Body: ModalBody,
    Footer: ModalFooter,
    headerInfo: null,
    invites: [],
    inviteStatus: {},
    member: undefined,
    pendingInvites: [
      {
        emails: new Set<string>(),
        teams: new Set<string>(),
        role: 'member',
      },
    ],
    reset: () => {},
    sendingInvites: false,
    sendInvites: () => {},
    setEmails: () => {},
    setRole: () => {},
    setTeams: () => {},
    willInvite: false,
  };

  it('renders', function () {
    render(<InviteMembersModalNew {...modalProps} />);

    expect(screen.getByText('Invite New Members')).toBeInTheDocument();
  });

  it('renders with error', function () {
    const modalPropsWithError = {
      ...modalProps,
      error: 'This is an error message',
    };
    render(<InviteMembersModalNew {...modalPropsWithError} />);

    // Check that the Alert component renders with the provided error message
    expect(screen.getByText('This is an error message')).toBeInTheDocument();
  });
});
