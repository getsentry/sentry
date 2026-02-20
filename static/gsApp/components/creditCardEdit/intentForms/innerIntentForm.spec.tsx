import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ApiQueryKey} from 'sentry/utils/queryClient';

import {FTCConsentLocation} from 'getsentry/types';

import InnerIntentForm from './innerIntentForm';

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
    jest.spyOn(stripeImport, 'useStripe').mockReturnValue(null as any);
    jest.spyOn(stripeImport, 'useElements').mockReturnValue(null as any);

    render(<InnerIntentForm {...defaultProps} />);

    act(() => {
      jest.advanceTimersByTime(10001);
    });

    expect(
      screen.getByText(
        /To add or update your payment method, you may need to disable any ad or tracker blocking extensions/
      )
    ).toBeInTheDocument();

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

  it('renders busy button text when submitting', () => {
    render(<InnerIntentForm {...defaultProps} isSubmitting busyButtonText="Saving..." />);

    expect(screen.getByRole('button', {name: 'Saving...'})).toBeInTheDocument();
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
