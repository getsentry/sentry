import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {
  defaultInviteProps,
  InviteMembersContext,
} from 'sentry/components/modals/inviteMembersModal/inviteMembersContext';
import InviteMembersFooter from 'sentry/components/modals/inviteMembersModal/inviteMembersFooter';

describe('InviteRowControlNew', function () {
  const renderComponent = (props: any) => {
    render(
      <InviteMembersContext.Provider
        value={{...defaultInviteProps, ...props, willInvite: true}}
      >
        <InviteMembersFooter canSend />
      </InviteMembersContext.Provider>,
      {organization: OrganizationFixture()}
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

    const sendButton = screen.getByRole('button', {name: 'Send invite'});
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
    });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(
      screen.getByRole('alert', {name: textWithMarkupMatcher('2 invites sent')})
    ).toBeInTheDocument();
  });

  it('displays correct status message for failed invites', function () {
    renderComponent({
      complete: true,
      inviteStatus: {
        'moo-deng': {sent: false, error: 'Error'},
        'moo-waan': {sent: false, error: 'Error'},
      },
    });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(
      screen.getByRole('alert', {name: textWithMarkupMatcher('2 invites failed to send')})
    ).toBeInTheDocument();
  });

  it('displays correct status message for sent and failed invites', function () {
    renderComponent({
      complete: true,
      inviteStatus: {
        'moo-deng': {sent: true},
        'moo-waan': {sent: true},
        'moo-toon': {sent: false, error: 'Error'},
      },
    });
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(
      screen.getByRole('alert', {name: textWithMarkupMatcher('2 invites sent')})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('alert', {name: textWithMarkupMatcher('1 invite failed to send')})
    ).toBeInTheDocument();
  });
});
