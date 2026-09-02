import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as webAuthnHandlers from 'sentry/components/webAuthn/handlers';

import {WebAuthn2FAMethod} from './webAuthn2faMethod';

const publicKeyCredentialDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'PublicKeyCredential'
);

describe('WebAuthn2FAMethod', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      configurable: true,
      value: function PublicKeyCredential() {},
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();

    if (publicKeyCredentialDescriptor) {
      Object.defineProperty(window, 'PublicKeyCredential', publicKeyCredentialDescriptor);
    } else {
      Reflect.deleteProperty(window, 'PublicKeyCredential');
    }
  });

  it('allows a failed assertion to be retried', async () => {
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
      <WebAuthn2FAMethod
        isActive
        isProcessing={false}
        submissionFailed={false}
        onRetrySubmission={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    expect(
      await screen.findByText('Passkey authentication was unsuccessful.')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

    await waitFor(() => expect(handleSign).toHaveBeenCalledTimes(2));
    retryAssertion.resolve(null);
    expect(
      await screen.findByText('Passkey authentication was unsuccessful.')
    ).toBeInTheDocument();
  });

  it('requests a new challenge after activation fails', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      statusCode: 503,
      body: {detail: 'Challenge unavailable'},
    });
    render(
      <WebAuthn2FAMethod
        isActive
        isProcessing={false}
        submissionFailed={false}
        onRetrySubmission={jest.fn()}
        onSubmit={jest.fn()}
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

  it('preserves a pending assertion across an equivalent rerender', async () => {
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
    const onSubmit = jest.fn();
    const {rerender} = render(
      <WebAuthn2FAMethod
        isActive
        isProcessing={false}
        submissionFailed={false}
        onRetrySubmission={jest.fn()}
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => expect(resolveAssertion).toBeDefined());
    rerender(
      <WebAuthn2FAMethod
        isActive
        isProcessing={false}
        submissionFailed={false}
        onRetrySubmission={jest.fn()}
        onSubmit={onSubmit}
      />
    );
    resolveAssertion?.(
      JSON.stringify({
        keyHandle: 'key-handle',
        clientData: 'client-data',
        authenticatorData: 'authenticator-data',
        signatureData: 'signature-data',
      })
    );

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(handleSign).toHaveBeenCalledTimes(1);
  });
});
