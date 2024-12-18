import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import InviteMembersModalView from 'sentry/components/modals/inviteMembersModal/inviteMembersModalview';

describe('InviteMembersModalView', function () {
  const styledWrapper = styled(c => c.children);
  const modalProps: ComponentProps<typeof InviteMembersModalView> = {
    Footer: styledWrapper(),
    addInviteRow: () => {},
    canSend: true,
    closeModal: () => {},
    complete: false,
    headerInfo: null,
    inviteStatus: {},
    invites: [],
    member: undefined,
    pendingInvites: [],
    removeInviteRow: () => {},
    reset: () => {},
    sendInvites: () => {},
    sendingInvites: false,
    setEmails: () => {},
    setRole: () => {},
    setTeams: () => {},
    willInvite: false,
    isOverMemberLimit: false,
  };

  const overMemberLimitModalProps: ComponentProps<typeof InviteMembersModalView> = {
    Footer: styledWrapper(),
    addInviteRow: () => {},
    canSend: true,
    closeModal: () => {},
    complete: false,
    headerInfo: null,
    inviteStatus: {},
    invites: [],
    member: undefined,
    pendingInvites: [],
    removeInviteRow: () => {},
    reset: () => {},
    sendInvites: () => {},
    sendingInvites: false,
    setEmails: () => {},
    setRole: () => {},
    setTeams: () => {},
    willInvite: true,
    isOverMemberLimit: true,
  };

  it('renders', function () {
    render(<InviteMembersModalView {...modalProps} />);

    expect(screen.getByText('Invite New Members')).toBeInTheDocument();
    expect(screen.getByText('Add another')).toBeInTheDocument();
  });

  it('renders with error', function () {
    const modalPropsWithError = {
      ...modalProps,
      error: 'This is an error message',
    };
    render(<InviteMembersModalView {...modalPropsWithError} />);

    // Check that the Alert component renders with the provided error message
    expect(screen.getByText('This is an error message')).toBeInTheDocument();
  });

  it('renders when over member limit', function () {
    render(<InviteMembersModalView {...overMemberLimitModalProps} />);

    expect(screen.getByText('Invite New Members')).toBeInTheDocument();
  });
});
