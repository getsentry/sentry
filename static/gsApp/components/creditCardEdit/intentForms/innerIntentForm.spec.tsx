import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';

import {FTCConsentLocation} from 'getsentry/types';

import {InnerIntentForm} from './innerIntentForm';

describe('InnerIntentForm', () => {
  const organization = OrganizationFixture({});
  const defaultProps = {
    organization,
    handleSubmit: jest.fn(),
    onError: jest.fn(),
    budgetTerm: 'pay-as-you-go',
    buttonText: 'Save Payment Method',
    location: 0,
    isSubmitting: false,
    cardMode: 'setup' as const,
    intentDataQueryKey: [''] as unknown as ApiQueryKey,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('hides loading indicator once Stripe loads', async () => {
    render(<InnerIntentForm {...defaultProps} />);

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
  });

  it('shows warning when Stripe hooks return null', async () => {
    jest.useFakeTimers();

    const stripeImport = await import('@stripe/react-stripe-js');
    jest.spyOn(stripeImport, 'useStripe').mockReturnValue(null);
    jest.spyOn(stripeImport, 'useElements').mockReturnValue(null);

    render(<InnerIntentForm {...defaultProps} />);

    act(() => {
      jest.advanceTimersByTime(10001);
    });

    expect(
      screen.getByText(
        /To add or update your payment method, you may need to disable any ad or tracker blocking extensions/
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save Payment Method'})).toBeEnabled();

    jest.useRealTimers();
  });

  it('shows error message when provided', () => {
    render(<InnerIntentForm {...defaultProps} errorMessage="Payment failed" />);

    expect(screen.getByText('Payment failed')).toBeInTheDocument();
  });

  it('renders cancel button when onCancel is provided', () => {
    const onCancel = jest.fn();
    render(<InnerIntentForm {...defaultProps} onCancel={onCancel} />);

    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });

  it('keeps the submit label while submitting', () => {
    render(<InnerIntentForm {...defaultProps} isSubmitting />);

    expect(screen.getByRole('button', {name: 'Save Payment Method'})).toBeInTheDocument();
  });

  it('allows submission before the Stripe element is complete', () => {
    render(<InnerIntentForm {...defaultProps} />);

    expect(screen.getByRole('button', {name: 'Save Payment Method'})).toBeEnabled();
  });

  it('reports a rejected submission through onError', async () => {
    const handleSubmit = jest.fn().mockRejectedValue(new Error('Payment failed'));
    const onError = jest.fn();
    render(
      <InnerIntentForm {...defaultProps} handleSubmit={handleSubmit} onError={onError} />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Save Payment Method'}));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Payment failed'));
  });

  it('prevents another submission while the first is in progress', async () => {
    let finishSubmit!: () => void;
    const handleSubmit = jest.fn(
      () =>
        new Promise<void>(resolve => {
          finishSubmit = resolve;
        })
    );
    render(<InnerIntentForm {...defaultProps} handleSubmit={handleSubmit} />);

    const submitButton = screen.getByRole('button', {
      name: 'Save Payment Method',
    });
    await userEvent.click(submitButton);
    expect(submitButton).toBeDisabled();

    await userEvent.click(submitButton);
    expect(handleSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishSubmit();
      await Promise.resolve();
    });
    expect(submitButton).toBeEnabled();
  });

  it('cancels without submitting', async () => {
    const onCancel = jest.fn();
    const handleSubmit = jest.fn();
    render(
      <InnerIntentForm
        {...defaultProps}
        onCancel={onCancel}
        handleSubmit={handleSubmit}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('displays billing terms when location is defined', async () => {
    render(<InnerIntentForm {...defaultProps} location={FTCConsentLocation.CHECKOUT} />);

    await screen.findByText(/you authorize Sentry to automatically charge you/);
  });

  it('does not display billing terms when location is not defined', async () => {
    render(<InnerIntentForm {...defaultProps} location={undefined} />);

    await waitFor(() => {
      expect(
        screen.queryByText(/you authorize Sentry to automatically charge you/)
      ).not.toBeInTheDocument();
    });
  });
});
