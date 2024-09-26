import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {InviteMembersContext} from 'sentry/components/modals/inviteMembersModal/inviteMembersContext';
import InviteMembersFooter from 'sentry/components/modals/inviteMembersModal/inviteMembersFooter';

describe('InviteRowControlNew', function () {
  const providerProps = {
    complete: false,
    inviteStatus: {},
    invites: [],
    pendingInvites: [
      {
        emails: new Set<string>(),
        teams: new Set<string>(),
        role: '',
      },
    ],
    reset: () => {},
    sendInvites: () => {},
    sendingInvites: false,
    setEmails: () => {},
    setRole: () => {},
    setTeams: () => {},
    willInvite: true,
  };
  const getComponent = props => (
    <InviteMembersContext.Provider value={props}>
      <InviteMembersFooter canSend />
    </InviteMembersContext.Provider>
  );

  it('disables send button when there are no emails', function () {
    render(getComponent(providerProps));

    const sendButton = screen.getByLabelText(/send invite/i);
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when there are emails', async function () {
    const mockSendInvites = jest.fn();
    render(
      getComponent({
        ...providerProps,
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

  it('displays correct status message for 1 sent invite', function () {
    render(
      getComponent({
        ...providerProps,
        complete: true,
        inviteStatus: {
          'moo-deng': {sent: true},
        },
      })
    );
    expect(screen.getByText(/sent/i)).toBeInTheDocument();
    expect(screen.getByText(/1 invite/i)).toBeInTheDocument();
  });

  it('displays correct status message for multiple sent invites', function () {
    render(
      getComponent({
        ...providerProps,
        complete: true,
        inviteStatus: {
          'moo-deng': {sent: true},
          'moo-waan': {sent: true},
        },
      })
    );
    expect(screen.getByText(/sent/i)).toBeInTheDocument();
    expect(screen.getByText(/2 invites/i)).toBeInTheDocument();
  });

  it('displays correct status message for failed invites', function () {
    render(
      getComponent({
        ...providerProps,
        complete: true,
        inviteStatus: {
          'moo-deng': {sent: false, error: 'Error'},
          'moo-waan': {sent: false, error: 'Error'},
        },
      })
    );
    expect(screen.getByText(/sent , 2 failed to send\./i)).toBeInTheDocument();
    expect(screen.getByText(/0 invites/i)).toBeInTheDocument();
  });

  it('displays correct status message for sent and failed invites', function () {
    render(
      getComponent({
        ...providerProps,
        complete: true,
        inviteStatus: {
          'moo-deng': {sent: true},
          'moo-waan': {sent: false, error: 'Error'},
        },
      })
    );
    expect(screen.getByText(/sent , 1 failed to send\./i)).toBeInTheDocument();
    expect(screen.getByText(/1 invite/i)).toBeInTheDocument();
  });

  it('displays correct status message for multiple sent and failed invites', function () {
    render(
      getComponent({
        ...providerProps,
        complete: true,
        inviteStatus: {
          'moo-deng': {sent: true},
          'moo-waan': {sent: true},
          'moo-toon': {sent: false, error: 'Error'},
        },
      })
    );
    expect(screen.getByText(/sent , 1 failed to send\./i)).toBeInTheDocument();
    expect(screen.getByText(/2 invites/i)).toBeInTheDocument();
  });
});
