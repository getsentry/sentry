import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Sms2FAMethod} from './sms2faMethod';

describe('Sms2FAMethod', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('activates SMS and resends the challenge', async () => {
    jest.useFakeTimers();
    const challengeRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: {method: 'sms', expiresIn: 45},
    });
    render(
      <Sms2FAMethod isActive isProcessing={false} onSubmit={jest.fn()} resetKey={null} />
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
  });

  it('shows the sending state until activation completes', async () => {
    const activation = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      asyncDelay: activation.promise,
      body: {method: 'sms', expiresIn: 45},
    });
    render(
      <Sms2FAMethod isActive isProcessing={false} onSubmit={jest.fn()} resetKey={null} />
    );

    expect(await screen.findByText('Sending SMS second factor code...')).toBeVisible();
    expect(screen.queryByRole('button', {name: /Resend/})).not.toBeInTheDocument();

    act(() => activation.resolve());

    expect(await screen.findByRole('button', {name: 'Resend (45)'})).toBeVisible();
  });

  it('allows a failed activation to be retried', async () => {
    const initialRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      statusCode: 503,
      body: {detail: 'Unable to send SMS code'},
    });
    render(
      <Sms2FAMethod isActive isProcessing={false} onSubmit={jest.fn()} resetKey={null} />
    );

    expect(await screen.findByText('Unable to send SMS code')).toBeVisible();
    expect(initialRequest).toHaveBeenCalledTimes(1);

    const retryRequest = MockApiClient.addMockResponse({
      url: '/auth/2fa/challenge/',
      method: 'POST',
      body: {method: 'sms', expiresIn: 45},
    });
    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

    await waitFor(() => expect(retryRequest).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', {name: 'Resend (45)'})).toBeVisible();
  });
});
