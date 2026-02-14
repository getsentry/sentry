import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import type {ChallengeData} from 'sentry/types/auth';

import {WebAuthnAssert} from './webAuthnAssert';

jest.mock('./handlers', () => ({
  handleSign: jest.fn(() => Promise.resolve(JSON.stringify({keyHandle: 'test'}))),
}));

const challengeData: ChallengeData = {
  webAuthnAuthenticationData: 'dGVzdA',
  authenticateRequests: {
    version: 'U2F_V2',
    challenge: 'test-challenge',
    appId: 'https://sentry.io',
    keyHandle: 'test-key-handle',
  },
  registerRequests: {
    version: 'U2F_V2',
    challenge: 'test-challenge',
    appId: 'https://sentry.io',
  },
  registeredKeys: [],
};

describe('WebAuthnAssert', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(document, 'hasFocus').mockReturnValue(true);
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: jest.fn(),
      writable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not trigger webAuthn immediately on mount', () => {
    const {handleSign} = jest.requireMock('./handlers');
    handleSign.mockClear();

    render(<WebAuthnAssert challengeData={challengeData} />);

    // Should NOT have been called synchronously on mount
    expect(handleSign).not.toHaveBeenCalled();
  });

  it('triggers webAuthn after a delay', async () => {
    const {handleSign} = jest.requireMock('./handlers');
    handleSign.mockClear();

    render(<WebAuthnAssert challengeData={challengeData} />);

    // Advance past the delay and flush microtasks from the resolved promise
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(handleSign).toHaveBeenCalledTimes(1);
  });

  it('renders the sign-in message', () => {
    render(<WebAuthnAssert challengeData={challengeData} />);

    expect(
      screen.getByText('Sign in with your passkey, biometrics, or security key.')
    ).toBeInTheDocument();
  });

  it('cleans up timeout on unmount', () => {
    const {handleSign} = jest.requireMock('./handlers');
    handleSign.mockClear();

    const {unmount} = render(<WebAuthnAssert challengeData={challengeData} />);

    // Unmount before the delay fires
    unmount();

    // Advance past the delay — should not trigger after unmount
    act(() => jest.advanceTimersByTime(300));

    expect(handleSign).not.toHaveBeenCalled();
  });
});
