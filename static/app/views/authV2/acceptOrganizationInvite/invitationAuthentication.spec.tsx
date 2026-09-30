import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {AuthConfig} from 'sentry/types/auth';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {mockElementFromPoint} from 'sentry/views/authV2/authLogin/components/testUtils';

import {InvitationAuthentication} from './invitationAuthentication';

const authConfig: AuthConfig = {
  canRegister: true,
  hasNewsletter: false,
  pendingMfa: null,
  serverHostname: 'sentry.example.com',
};

describe('InvitationAuthentication', () => {
  mockElementFromPoint();

  it('prefills registration and switches between creating and signing into an account', async () => {
    render(
      <InvitationAuthentication
        authConfig={authConfig}
        initialEmail="invitee@example.com"
        onAuthenticated={jest.fn()}
      />
    );

    expect(screen.getByRole('textbox', {name: 'Email'})).toHaveValue(
      'invitee@example.com'
    );
    const signIn = screen.getByRole('button', {name: 'Sign in'});
    expect(signIn.parentElement).toHaveTextContent('Have an account? Sign in');
    await userEvent.click(signIn);
    const createAccount = await screen.findByRole('button', {
      name: 'Create one',
    });
    expect(createAccount.parentElement).toHaveTextContent(
      "Don't have an account? Create one"
    );
    await userEvent.click(createAccount);

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Create account'})).toBeVisible()
    );
    expect(screen.getByRole('textbox', {name: 'Email'})).toHaveValue(
      'invitee@example.com'
    );
  });

  it('reports registration without navigating away from the invitation', async () => {
    const user = UserFixture({
      email: 'invitee@example.com',
      name: 'Jane Doe',
    });
    const result = {nextUri: '/organizations/', user};
    const onAuthenticated = jest.fn();
    MockApiClient.addMockResponse({
      url: '/auth/register/',
      method: 'POST',
      body: result,
    });

    render(
      <InvitationAuthentication
        authConfig={authConfig}
        initialEmail={user.email}
        onAuthenticated={onAuthenticated}
      />
    );

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), user.name);
    await userEvent.type(screen.getByLabelText('Password'), 'a-secure-password');
    await userEvent.click(screen.getByRole('button', {name: 'Create account'}));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(result));
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('allows invitees to register when public signup is disabled', async () => {
    const result = {nextUri: '/organizations/', user: UserFixture()};
    const onAuthenticated = jest.fn();
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: result,
    });

    render(
      <InvitationAuthentication
        authConfig={{
          ...authConfig,
          canRegister: false,
          googleLoginLink: '/auth/login/google/',
        }}
        onAuthenticated={onAuthenticated}
      />
    );

    expect(screen.getByRole('button', {name: 'Create account'})).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'Sign in'}));
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Create one'})).toBeVisible()
    );
    expect(screen.getByRole('button', {name: 'Google'})).toHaveAttribute(
      'href',
      '/auth/login/google/'
    );
    await userEvent.type(screen.getByRole('textbox', {name: 'Email'}), result.user.email);
    await userEvent.type(screen.getByLabelText('Password'), 'password');
    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));

    await waitFor(() =>
      expect(onAuthenticated).toHaveBeenCalledWith({...result, status: 'authenticated'})
    );
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('completes sign-in through MFA before reporting authentication', async () => {
    const result = {nextUri: '/organizations/', user: UserFixture()};
    const onAuthenticated = jest.fn();
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: {mfaRequired: true, mfaMethods: [{id: 'totp'}]},
    });
    const secondFactor = MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      body: result,
    });

    render(
      <InvitationAuthentication
        authConfig={authConfig}
        onAuthenticated={onAuthenticated}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Sign in'}));
    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Email'}),
      result.user.email
    );
    await userEvent.type(screen.getByLabelText('Password'), 'password');
    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));
    await screen.findByText('Enter the code from your Authenticator');

    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: 'Create one'})).not.toBeInTheDocument();
    await userEvent.type(
      screen.getByRole('textbox', {name: 'One-time password'}),
      '123456'
    );

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(result));
    expect(secondFactor).toHaveBeenCalledWith(
      '/auth/2fa/',
      expect.objectContaining({data: {method: 'totp', otp: '123456'}})
    );
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('cancels a configured MFA session and returns to password sign-in', async () => {
    const cancel = MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'DELETE',
    });

    render(
      <InvitationAuthentication
        authConfig={{
          ...authConfig,
          pendingMfa: {mfaRequired: true, mfaMethods: [{id: 'totp'}]},
        }}
        onAuthenticated={jest.fn()}
      />
    );

    expect(screen.getByText('Enter the code from your Authenticator')).toBeVisible();
    expect(
      screen.queryByRole('button', {name: 'Create account'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Create one'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Back to Login'}));

    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: 'Email'})).toBeVisible()
    );
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
