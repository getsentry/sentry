import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as webAuthnHandlers from 'sentry/components/webAuthn/handlers';

import {SecondFactorAuth} from './secondFactorAuth';
import {mockElementFromPoint} from './testUtils';

const publicKeyCredentialDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'PublicKeyCredential'
);

describe('SecondFactorAuth', () => {
  mockElementFromPoint();

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();

    if (publicKeyCredentialDescriptor) {
      Object.defineProperty(window, 'PublicKeyCredential', publicKeyCredentialDescriptor);
    } else {
      Reflect.deleteProperty(window, 'PublicKeyCredential');
    }
  });

  it('discovers methods and selects the highest-priority method', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      body: {
        mfaRequired: true,
        mfaMethods: [{id: 'recovery'}, {id: 'totp'}],
      },
    });

    render(<SecondFactorAuth onBack={jest.fn()} onComplete={jest.fn()} />);

    expect(
      await screen.findByText('Enter the code from your Authenticator')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Contact support'})).toHaveAttribute(
      'href',
      'https://www.sentry.help/'
    );
  });

  it('does not reactivate SMS after switching methods', async () => {
    const challengeRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: {method: 'sms', expiresIn: 45},
    });

    render(
      <SecondFactorAuth
        methods={[{id: 'sms'}, {id: 'recovery'}]}
        onBack={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    await screen.findByRole('button', {name: 'Resend (45)'});
    await userEvent.click(screen.getByRole('button', {name: 'Use recovery code'}));
    await userEvent.click(screen.getByRole('button', {name: 'Use SMS code'}));

    expect(await screen.findByRole('button', {name: 'Resend (45)'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(challengeRequest).toHaveBeenCalledTimes(1);
  });

  it('completes a WebAuthn challenge without additional UI', async () => {
    const user = UserFixture();
    const onComplete = jest.fn();
    const webAuthnResponse = {
      keyHandle: 'key-handle',
      clientData: 'client-data',
      authenticatorData: 'authenticator-data',
      signatureData: 'signature-data',
    };
    const handleSign = jest
      .spyOn(webAuthnHandlers, 'handleSign')
      .mockResolvedValue(JSON.stringify(webAuthnResponse));
    Object.defineProperty(window, 'PublicKeyCredential', {
      configurable: true,
      value: function PublicKeyCredential() {},
    });
    const challengeRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: {
        method: 'u2f',
        challenge: {webAuthnAuthenticationData: 'challenge'},
      },
    });
    const authorization = Promise.withResolvers<void>();
    const authRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      body: {nextUri: '/organizations/', user},
      asyncDelay: authorization.promise,
    });

    render(
      <SecondFactorAuth
        methods={[{id: 'u2f'}]}
        onBack={jest.fn()}
        onComplete={onComplete}
      />
    );

    expect(
      screen.getByText('Waiting for passkey, biometric, or hardware key')
    ).toBeInTheDocument();
    await waitFor(() => expect(challengeRequest).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(handleSign).toHaveBeenCalledWith({
        webAuthnAuthenticationData: 'challenge',
      })
    );
    await waitFor(() =>
      expect(authRequest).toHaveBeenCalledWith(
        '/auth/2fa/',
        expect.objectContaining({
          method: 'POST',
          data: {method: 'u2f', response: webAuthnResponse},
        })
      )
    );
    expect(screen.getByText('Authorizing...')).toBeInTheDocument();
    act(() => authorization.resolve());
    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({nextUri: '/organizations/', user})
    );
  });

  it('requests a fresh WebAuthn challenge after submission fails', async () => {
    const webAuthnResponse = {
      keyHandle: 'key-handle',
      clientData: 'client-data',
      authenticatorData: 'authenticator-data',
      signatureData: 'signature-data',
    };
    const handleSign = jest
      .spyOn(webAuthnHandlers, 'handleSign')
      .mockResolvedValueOnce(JSON.stringify(webAuthnResponse))
      .mockResolvedValueOnce(null);
    Object.defineProperty(window, 'PublicKeyCredential', {
      configurable: true,
      value: function PublicKeyCredential() {},
    });
    const initialChallengeRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: {
        method: 'u2f',
        challenge: {webAuthnAuthenticationData: 'initial-challenge'},
      },
    });
    MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Invalid two-factor authentication credentials'},
    });

    render(
      <SecondFactorAuth
        methods={[{id: 'u2f'}]}
        onBack={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    expect(
      await screen.findByText('Invalid two-factor authentication credentials')
    ).toBeVisible();
    expect(initialChallengeRequest).toHaveBeenCalledTimes(1);
    expect(handleSign).toHaveBeenCalledTimes(1);

    const retryChallengeRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: {
        method: 'u2f',
        challenge: {webAuthnAuthenticationData: 'retry-challenge'},
      },
    });
    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

    await waitFor(() => expect(retryChallengeRequest).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(handleSign).toHaveBeenLastCalledWith({
        webAuthnAuthenticationData: 'retry-challenge',
      })
    );
  });

  it('ignores a WebAuthn assertion after switching methods', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      configurable: true,
      value: function PublicKeyCredential() {},
    });
    let resolveAssertion: ((response: string) => void) | undefined;
    jest.spyOn(webAuthnHandlers, 'handleSign').mockReturnValue(
      new Promise(resolve => {
        resolveAssertion = resolve;
      })
    );
    MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: {
        method: 'u2f',
        challenge: {webAuthnAuthenticationData: 'challenge'},
      },
    });
    const authRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      body: {nextUri: '/organizations/', user: UserFixture()},
    });

    render(
      <SecondFactorAuth
        methods={[{id: 'u2f'}, {id: 'recovery'}]}
        onBack={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    await waitFor(() => expect(resolveAssertion).toBeDefined());
    await userEvent.click(screen.getByRole('button', {name: 'Use recovery code'}));
    resolveAssertion?.(
      JSON.stringify({
        keyHandle: 'key-handle',
        clientData: 'client-data',
        authenticatorData: 'authenticator-data',
        signatureData: 'signature-data',
      })
    );

    await act(async () => {});
    expect(authRequest).not.toHaveBeenCalled();
  });

  it('starts a new WebAuthn assertion after switching away and back', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      configurable: true,
      value: function PublicKeyCredential() {},
    });
    const handleSign = jest
      .spyOn(webAuthnHandlers, 'handleSign')
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValueOnce(null);
    const challenges = ['initial-challenge', 'retry-challenge'];
    const initialChallengeRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: () => ({
        method: 'u2f',
        challenge: {webAuthnAuthenticationData: challenges.shift()},
      }),
    });

    render(
      <SecondFactorAuth
        methods={[{id: 'u2f'}, {id: 'recovery'}]}
        onBack={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    await waitFor(() =>
      expect(handleSign).toHaveBeenCalledWith({
        webAuthnAuthenticationData: 'initial-challenge',
      })
    );
    await userEvent.click(screen.getByRole('button', {name: 'Use recovery code'}));
    await userEvent.click(screen.getByRole('button', {name: 'Use passkey'}));

    await waitFor(() => expect(initialChallengeRequest).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(handleSign).toHaveBeenLastCalledWith({
        webAuthnAuthenticationData: 'retry-challenge',
      })
    );
  });

  it('returns to login', async () => {
    const onBack = jest.fn();
    const cancelRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'DELETE',
      statusCode: 204,
    });
    render(
      <SecondFactorAuth methods={[{id: 'totp'}]} onBack={onBack} onComplete={jest.fn()} />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Back to Login'}));

    await waitFor(() => expect(cancelRequest).toHaveBeenCalledTimes(1));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('disables navigation while authentication is pending', async () => {
    const response = Promise.withResolvers<{
      nextUri: string;
      user: ReturnType<typeof UserFixture>;
    }>();
    const onComplete = jest.fn();
    MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      body: () => response.promise,
    });
    render(
      <SecondFactorAuth
        methods={[{id: 'totp'}, {id: 'recovery'}]}
        onBack={jest.fn()}
        onComplete={onComplete}
      />
    );

    await userEvent.type(
      screen.getByRole('textbox', {name: 'One-time password'}),
      '123456'
    );

    expect(screen.getByRole('button', {name: 'Back to Login'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Use recovery code'})).toBeDisabled();
    response.resolve({nextUri: '/organizations/', user: UserFixture()});
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('disables authentication controls while cancellation is pending', async () => {
    const response = Promise.withResolvers<undefined>();
    const onBack = jest.fn();
    MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'DELETE',
      statusCode: 204,
      body: () => response.promise,
    });
    render(
      <SecondFactorAuth
        methods={[{id: 'totp'}, {id: 'recovery'}]}
        onBack={onBack}
        onComplete={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Back to Login'}));

    expect(screen.getByRole('textbox', {name: 'One-time password'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Use recovery code'})).toBeDisabled();
    response.resolve(undefined);
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });

  it('disables WebAuthn retry while cancellation is pending', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      configurable: true,
      value: function PublicKeyCredential() {},
    });
    jest
      .spyOn(webAuthnHandlers, 'handleSign')
      .mockRejectedValue(new Error('Authentication cancelled'));
    MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: {
        method: 'u2f',
        challenge: {webAuthnAuthenticationData: 'challenge'},
      },
    });
    const cancellation = Promise.withResolvers<undefined>();
    MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'DELETE',
      statusCode: 204,
      body: () => cancellation.promise,
    });
    const onBack = jest.fn();
    render(
      <SecondFactorAuth methods={[{id: 'u2f'}]} onBack={onBack} onComplete={jest.fn()} />
    );

    expect(await screen.findByRole('button', {name: 'Try again'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Back to Login'}));

    expect(screen.getByRole('button', {name: 'Try again'})).toBeDisabled();
    cancellation.resolve(undefined);
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });

  it('replaces a cancellation error when authentication fails', async () => {
    const onBack = jest.fn();
    MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'DELETE',
      statusCode: 500,
      body: {detail: 'Cancellation failed'},
    });
    MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Invalid authentication code'},
    });
    render(
      <SecondFactorAuth methods={[{id: 'totp'}]} onBack={onBack} onComplete={jest.fn()} />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Back to Login'}));

    expect(await screen.findByText('Cancellation failed')).toBeVisible();
    expect(onBack).not.toHaveBeenCalled();

    await userEvent.type(
      screen.getByRole('textbox', {name: 'One-time password'}),
      '123456'
    );

    expect(await screen.findByText('Invalid authentication code')).toBeVisible();
    expect(screen.queryByText('Cancellation failed')).not.toBeInTheDocument();
  });
});
