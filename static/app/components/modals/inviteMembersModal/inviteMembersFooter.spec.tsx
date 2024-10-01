import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  defaultInviteProps,
  InviteMembersContext,
} from 'sentry/components/modals/inviteMembersModal/inviteMembersContext';
import InviteMembersFooter from 'sentry/components/modals/inviteMembersModal/inviteMembersFooter';

describe('InviteRowControlNew', function () {
  const renderComponent = props => {
    render(
      <InviteMembersContext.Provider value={{...defaultInviteProps, ...props}}>
        <InviteMembersFooter canSend />
      </InviteMembersContext.Provider>,
      {organization: OrganizationFixture({features: ['invite-members-new-modal']})}
    );
  };

  it('disables send button when there are no emails', function () {
    renderComponent({});

    const sendButton = screen.getByLabelText(/send invite/i);
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when there are emails', async function () {
    const mockSetInviteStatus = jest.fn();
    const mockSendInvites = jest.fn();
    renderComponent({
      invites: [
        {
          email: 'moo-deng@email.com',
          role: 'member',
          teams: new Set<string>(['moo-deng']),
        },
      ],
      setInviteStatus: mockSetInviteStatus,
      sendInvites: mockSendInvites,
    });

    const sendButton = screen.getByLabelText(/send invite/i);
    expect(sendButton).toBeEnabled();
    await userEvent.click(sendButton);
    expect(mockSetInviteStatus).toHaveBeenCalled();
    expect(mockSendInvites).toHaveBeenCalled();
  });

  it('displays correct status message for sent invites', function () {
    renderComponent({
      complete: true,
      inviteStatus: {
        'moo-deng': {sent: true},
        'moo-waan': {sent: true},
      },
      willInvite: true,
    });
    expect(screen.getByTestId('sent-invites')).toHaveTextContent(/2/i);
    expect(screen.queryByTestId('failed-invites')).not.toBeInTheDocument();
  });

  it('displays correct status message for failed invites', function () {
    renderComponent({
      complete: true,
      inviteStatus: {
        'moo-deng': {sent: false, error: 'Error'},
        'moo-waan': {sent: false, error: 'Error'},
      },
      willInvite: true,
    });
    expect(screen.getByText(/2/i)).toBeInTheDocument();
  });

  it('displays correct status message for sent and failed invites', function () {
    renderComponent({
      complete: true,
      inviteStatus: {
        'moo-deng': {sent: true},
        'moo-waan': {sent: true},
        'moo-toon': {sent: false, error: 'Error'},
      },
      willInvite: true,
    });
    expect(screen.getByTestId('sent-invites')).toHaveTextContent(/2/i);
    expect(screen.getByTestId('failed-invites')).toHaveTextContent(/1/i);
  });
});
