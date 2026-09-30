import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {InvitationStatus} from './invitationStatus';

describe('InvitationStatus', () => {
  it('asks an existing member to switch accounts', async () => {
    const onSwitchAccount = jest.fn();
    const {rerender} = render(
      <InvitationStatus
        step="existing-member"
        isAccepting={false}
        onAccept={jest.fn()}
        onSwitchAccount={onSwitchAccount}
      />
    );

    expect(
      screen.getByText('This account is already a member of the organization.')
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));

    expect(onSwitchAccount).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(
      <InvitationStatus
        step="existing-member"
        isAccepting={false}
        isCheckingInvite
        onAccept={jest.fn()}
        onSwitchAccount={onSwitchAccount}
      />
    );
    expect(screen.getByRole('button', {name: 'Switch account'})).toBeDisabled();
  });

  it('links to account security when two-factor setup is required', () => {
    const {rerender} = render(
      <InvitationStatus
        step="required-2fa"
        isAccepting={false}
        onAccept={jest.fn()}
        onSwitchAccount={jest.fn()}
      />
    );

    expect(
      screen.getByRole('button', {name: 'Configure Two-Factor Auth'})
    ).toHaveAttribute(
      'href',
      `${ConfigStore.get('links').sentryUrl}/settings/account/security/`
    );
    expect(
      screen.queryByRole('button', {name: 'Accept invitation'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Configure Two-Factor Auth'})
    ).toHaveAttribute('target', '_blank');
    const setupInstructions = screen.getByText(
      'This organization requires all members to configure two-factor authentication. Return to this tab after setting up two-factor to accept your invitation.'
    );
    expect(setupInstructions).toBeVisible();
    expect(setupInstructions).toAppearBefore(
      screen.getByRole('button', {name: 'Configure Two-Factor Auth'})
    );
    rerender(
      <InvitationStatus
        step="required-2fa"
        isAccepting={false}
        isCheckingInvite
        onAccept={jest.fn()}
        onSwitchAccount={jest.fn()}
      />
    );
    const setupButton = screen.getByRole('button', {name: 'Configure Two-Factor Auth'});
    expect(setupButton).toHaveAttribute('aria-disabled', 'true');
    expect(setupButton).not.toHaveAttribute('href');
  });

  it.each([
    ['sign-in-sso', 'Sign in with the organization’s SSO provider to continue.'],
    [
      'authenticate-sso',
      'Authenticate with the organization’s SSO provider to continue.',
    ],
  ] as const)('shows the %s status', (step, message) => {
    render(
      <InvitationStatus
        step={step}
        isAccepting={false}
        onAccept={jest.fn()}
        onSwitchAccount={jest.fn()}
      />
    );

    expect(screen.getByText(message)).toBeVisible();
    expect(
      screen.queryByRole('button', {name: 'Accept invitation'})
    ).not.toBeInTheDocument();
  });

  it('accepts an invitation and disables the action while submitting', async () => {
    const onAccept = jest.fn();
    const {rerender} = render(
      <InvitationStatus
        step="accept"
        isAccepting={false}
        onAccept={onAccept}
        onSwitchAccount={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Accept invitation'}));
    expect(onAccept).toHaveBeenCalledTimes(1);

    rerender(
      <InvitationStatus
        step="accept"
        isAccepting
        onAccept={onAccept}
        onSwitchAccount={jest.fn()}
      />
    );
    expect(screen.getByRole('button', {name: 'Accept invitation'})).toBeDisabled();
    rerender(
      <InvitationStatus
        step="accept"
        isAccepting={false}
        isCheckingInvite
        onAccept={onAccept}
        onSwitchAccount={jest.fn()}
      />
    );

    expect(screen.getByRole('button', {name: 'Accept invitation'})).toBeDisabled();
  });
});
