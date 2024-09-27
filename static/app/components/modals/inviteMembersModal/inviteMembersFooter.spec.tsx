import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  defaultInviteProps,
  InviteMembersContext,
} from 'sentry/components/modals/inviteMembersModal/inviteMembersContext';
import InviteMembersFooter from 'sentry/components/modals/inviteMembersModal/inviteMembersFooter';

describe('InviteRowControlNew', function () {
  const getComponent = props => (
    <InviteMembersContext.Provider value={props}>
      <InviteMembersFooter canSend />
    </InviteMembersContext.Provider>
  );

  it('disables send button when there are no emails', function () {
    render(getComponent(defaultInviteProps));

    const sendButton = screen.getByLabelText(/send invite/i);
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when there are emails', async function () {
    const mockSendInvites = jest.fn();
    render(
      getComponent({
        ...defaultInviteProps,
        invites: [
          {
            email: 'moo-deng@email.com',
            role: 'member',
            teams: new Set<string>(['moo-deng']),
          },
        ],
        sendInvites: mockSendInvites,
      })
    );

    const sendButton = screen.getByLabelText(/send invite/i);
    expect(sendButton).toBeEnabled();
    await userEvent.click(sendButton);
    expect(mockSendInvites).toHaveBeenCalled();
  });

  it('displays correct status message for sent invites', function () {
    render(
      getComponent({
        ...defaultInviteProps,
        complete: true,
        inviteStatus: {
          'moo-deng': {sent: true},
          'moo-waan': {sent: true},
        },
        willInvite: true,
      })
    );
    const element = screen.getByTestId('sent-invites');
    expect(element).toHaveTextContent(/2/i);
  });

  it('displays correct status message for failed invites', function () {
    render(
      getComponent({
        ...defaultInviteProps,
        complete: true,
        inviteStatus: {
          'moo-deng': {sent: false, error: 'Error'},
          'moo-waan': {sent: false, error: 'Error'},
        },
        willInvite: true,
      })
    );
    expect(screen.getByText(/2 failed to send\./i)).toBeInTheDocument();
  });

  it('displays correct status message for sent and failed invites', function () {
    render(
      getComponent({
        ...defaultInviteProps,
        complete: true,
        inviteStatus: {
          'moo-deng': {sent: true},
          'moo-waan': {sent: true},
          'moo-toon': {sent: false, error: 'Error'},
        },
        willInvite: true,
      })
    );
    const element = screen.getByTestId('sent-invites');
    expect(element).toHaveTextContent(/2/i);
    expect(screen.getByText(/1 failed to send\./i)).toBeInTheDocument();
  });

  it('displays pending invite message when willInvite is false', function () {
    render(
      getComponent({
        ...defaultInviteProps,
        complete: true,
        inviteStatus: {
          'moo-deng': {sent: true},
          'moo-waan': {sent: true},
          'moo-toon': {sent: false, error: 'Error'},
        },
      })
    );
    const element = screen.getByTestId('sent-invite-requests');
    expect(element).toHaveTextContent(/2/i);
    expect(screen.getByText(/1 failed to send\./i)).toBeInTheDocument();
  });
});
