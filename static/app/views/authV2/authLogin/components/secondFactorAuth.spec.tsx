import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as webAuthnHandlers from 'sentry/components/webAuthn/handlers';

import {SecondFactorAuth} from './secondFactorAuth';

const publicKeyCredentialDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'PublicKeyCredential'
);

describe('SecondFactorAuth', () => {
  beforeAll(() => {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: jest.fn(() => null),
    });
  });

  afterAll(() => {
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

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
  });

  it('activates SMS and resends the challenge', async () => {
    jest.useFakeTimers();
    const challengeRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: {method: 'sms', expiresIn: 45},
    });

    render(
      <SecondFactorAuth
        methods={[{id: 'sms'}]}
        onBack={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    const resendButton = await screen.findByRole('button', {name: 'Resend (45)'});
    expect(resendButton).toHaveAttribute('aria-disabled', 'true');

    act(() => jest.advanceTimersByTime(45_000));
    expect(screen.getByRole('button', {name: 'Resend'})).toBeEnabled();

    jest.useRealTimers();
    await userEvent.click(screen.getByRole('button', {name: 'Resend'}));

    await waitFor(() => expect(challengeRequest).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', {name: 'Resend (45)'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(challengeRequest).toHaveBeenLastCalledWith(
      '/auth/2fa/challenge/',
      expect.objectContaining({method: 'POST', data: {method: 'sms'}})
    );
  });

  it('shows the sending state until SMS activation completes', async () => {
    const activation = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      asyncDelay: activation.promise,
      body: {method: 'sms', expiresIn: 45},
    });

    render(
      <SecondFactorAuth
        methods={[{id: 'sms'}]}
        onBack={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    expect(await screen.findByText('Sending SMS second factor code...')).toBeVisible();
    expect(
      screen.queryByText(/A code has been sent by text message/)
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Resend/})).not.toBeInTheDocument();

    act(() => activation.resolve());

    expect(await screen.findByRole('button', {name: 'Resend (45)'})).toBeVisible();
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
    const authRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      body: {nextUri: '/organizations/', user},
    });

    render(
      <SecondFactorAuth
        methods={[{id: 'u2f'}]}
        onBack={jest.fn()}
        onComplete={onComplete}
      />
    );

    expect(
      screen.getByText(
        'Waiting for passkey, biometric, or hardware key authentication...'
      )
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
    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({nextUri: '/organizations/', user})
    );
  });

  it('allows a failed WebAuthn assertion to be retried', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      configurable: true,
      value: function PublicKeyCredential() {},
    });
    const retryAssertion = Promise.withResolvers<string | null>();
    const handleSign = jest
      .spyOn(webAuthnHandlers, 'handleSign')
      .mockRejectedValueOnce(new Error('Authentication cancelled'))
      .mockReturnValueOnce(retryAssertion.promise);
    MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: {
        method: 'u2f',
        challenge: {webAuthnAuthenticationData: 'challenge'},
      },
    });

    render(
      <SecondFactorAuth
        methods={[{id: 'u2f'}]}
        onBack={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    expect(
      await screen.findByText('Passkey authentication was unsuccessful.')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

    expect(screen.queryByRole('button', {name: 'Try again'})).not.toBeInTheDocument();
    await waitFor(() => expect(handleSign).toHaveBeenCalledTimes(2));

    retryAssertion.resolve(null);
    expect(
      await screen.findByText('Passkey authentication was unsuccessful.')
    ).toBeInTheDocument();
    expect(handleSign).toHaveBeenCalledTimes(2);
  });

  it('requests a new WebAuthn challenge after challenge activation fails', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      configurable: true,
      value: function PublicKeyCredential() {},
    });
    MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      statusCode: 503,
      body: {detail: 'Challenge unavailable'},
    });

    render(
      <SecondFactorAuth
        methods={[{id: 'u2f'}]}
        onBack={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    expect(await screen.findByText('Challenge unavailable')).toBeVisible();
    const challengeRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: {
        method: 'u2f',
        challenge: {webAuthnAuthenticationData: 'challenge'},
      },
    });
    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

    await waitFor(() => expect(challengeRequest).toHaveBeenCalledTimes(1));
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

  it('completes a pending WebAuthn assertion after an equivalent rerender', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      configurable: true,
      value: function PublicKeyCredential() {},
    });
    let resolveAssertion: ((response: string) => void) | undefined;
    const handleSign = jest.spyOn(webAuthnHandlers, 'handleSign').mockReturnValue(
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
    const methods = [{id: 'u2f' as const}];
    const {rerender} = render(
      <SecondFactorAuth methods={methods} onBack={jest.fn()} onComplete={jest.fn()} />
    );

    await waitFor(() => expect(resolveAssertion).toBeDefined());
    rerender(
      <SecondFactorAuth methods={methods} onBack={jest.fn()} onComplete={jest.fn()} />
    );
    resolveAssertion?.(
      JSON.stringify({
        keyHandle: 'key-handle',
        clientData: 'client-data',
        authenticatorData: 'authenticator-data',
        signatureData: 'signature-data',
      })
    );

    await waitFor(() => expect(authRequest).toHaveBeenCalledTimes(1));
    expect(handleSign).toHaveBeenCalledTimes(1);
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
    MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: {
        method: 'u2f',
        challenge: {webAuthnAuthenticationData: 'challenge'},
      },
    });

    render(
      <SecondFactorAuth
        methods={[{id: 'u2f'}, {id: 'recovery'}]}
        onBack={jest.fn()}
        onComplete={jest.fn()}
      />
    );

    await waitFor(() => expect(handleSign).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', {name: 'Use recovery code'}));
    await userEvent.click(screen.getByRole('button', {name: 'Use passkey'}));

    await waitFor(() => expect(handleSign).toHaveBeenCalledTimes(2));
  });

  it('submits an uppercase recovery code and reports completion', async () => {
    const user = UserFixture();
    const onComplete = jest.fn();
    const authRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      body: {nextUri: '/organizations/', user},
    });

    render(
      <SecondFactorAuth
        methods={[{id: 'recovery'}]}
        onBack={jest.fn()}
        onComplete={onComplete}
      />
    );

    await userEvent.type(
      screen.getByRole('textbox', {name: 'One-time password'}),
      'abcd1234'
    );

    await waitFor(() =>
      expect(authRequest).toHaveBeenCalledWith(
        '/auth/2fa/',
        expect.objectContaining({
          method: 'POST',
          data: {method: 'recovery', otp: 'ABCD1234'},
        })
      )
    );
    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({nextUri: '/organizations/', user})
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

  it('shows an error when cancellation fails', async () => {
    const onBack = jest.fn();
    MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'DELETE',
      statusCode: 500,
      body: {detail: 'Cancellation failed'},
    });
    render(
      <SecondFactorAuth methods={[{id: 'totp'}]} onBack={onBack} onComplete={jest.fn()} />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Back to Login'}));

    expect(await screen.findByText('Cancellation failed')).toBeVisible();
    expect(onBack).not.toHaveBeenCalled();
  });
});
