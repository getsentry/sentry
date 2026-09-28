import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ModalBody} from '@sentry/scraps/modal';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import InvoiceDetailsPaymentForm from 'getsentry/views/invoiceDetails/paymentForm';

// Stripe mocks handled by global setup.ts

describe('InvoiceDetails > Payment Form', () => {
  const organization = OrganizationFixture();
  const invoice = InvoiceFixture(
    {
      items: [
        {
          type: 'subscription',
          description: 'Subscription to Business',
          amount: 8900,
          periodEnd: '2021-10-21',
          periodStart: '2021-09-21',
          data: {},
        },
      ],
    },
    organization
  );
  const intentData = {
    clientSecret: 'pi_123abc',
    amount: 8900,
    currency: 'USD',
    returnUrl: 'https://example.com/',
  };

  beforeEach(() => {
    organization.features = [];
    MockApiClient.clearMockResponses();
    SubscriptionStore.set(organization.slug, {});
  });

  const modalDummy = ({children}: {children?: ReactNode}) => <div>{children}</div>;

  it('renders form', async () => {
    const mockget = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/${invoice.id}/new/`,
      method: 'GET',
      body: intentData,
    });
    render(
      <InvoiceDetailsPaymentForm
        organization={organization}
        Header={modalDummy}
        Body={ModalBody}
        closeModal={jest.fn()}
        reloadInvoice={jest.fn()}
        invoice={invoice}
      />
    );

    await waitFor(() => expect(mockget).toHaveBeenCalled());
    expect(screen.getByText('Pay Bill')).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Pay Now'})).toBeInTheDocument();
    expect(
      screen.queryByText(
        /, you authorize Sentry to automatically charge you recurring subscription fees and applicable on-demand fees. Recurring charges occur at the start of your selected billing cycle for subscription fees and monthly for on-demand fees. You may cancel your subscription at any time/
      )
    ).not.toBeInTheDocument();
  });

  it('completes 3D Secure without asking for a card again', async () => {
    // The charge was already attempted with the card on file and the issuer
    // wants the cardholder to authenticate, so the modal must not ask for
    // card details -- only run the challenge and hand the result back.
    const reloadInvoice = jest.fn();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/${invoice.id}/new/`,
      method: 'GET',
      body: {...intentData, requiresAction: true, paymentIntentId: 'pi_123abc'},
    });
    const mockConfirm = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/${invoice.id}/confirm/`,
      method: 'POST',
      body: {paid: true},
    });

    render(
      <InvoiceDetailsPaymentForm
        organization={organization}
        Header={modalDummy}
        Body={ModalBody}
        closeModal={jest.fn()}
        reloadInvoice={reloadInvoice}
        invoice={invoice}
      />
    );

    const button = await screen.findByRole('button', {name: 'Verify with your bank'});
    // The card form is what this flow exists to avoid.
    expect(screen.queryByRole('button', {name: 'Pay Now'})).not.toBeInTheDocument();

    await userEvent.click(button);

    // Authenticating leaves a manual-confirmation intent in
    // requires_confirmation, so the server has to finish it.
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(mockConfirm.mock.calls[0][1].data).toEqual({paymentIntentId: 'test-payment'});
    await waitFor(() => expect(reloadInvoice).toHaveBeenCalled());
  });

  it('falls back to the card form when verification fails', async () => {
    // A failed challenge spends the intent -- Stripe needs a new payment method
    // to fulfil it. Without refetching, the modal keeps offering a dead intent
    // and the customer has no way to pay.
    const reloadInvoice = jest.fn();
    let call = 0;
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/${invoice.id}/new/`,
      method: 'GET',
      body: () => {
        call += 1;
        // First load offers the parked challenge; after it fails the server
        // issues a fresh intent with no requiresAction.
        return call === 1
          ? {
              ...intentData,
              clientSecret: 'ERROR',
              requiresAction: true,
              paymentIntentId: 'pi_123abc',
            }
          : intentData;
      },
    });

    render(
      <InvoiceDetailsPaymentForm
        organization={organization}
        Header={modalDummy}
        Body={ModalBody}
        closeModal={jest.fn()}
        reloadInvoice={reloadInvoice}
        invoice={invoice}
      />
    );

    await userEvent.click(
      await screen.findByRole('button', {name: 'Verify with your bank'})
    );

    expect(await screen.findByText(/authentication failed/)).toBeInTheDocument();
    // The card form is back, so another card can be used.
    expect(await screen.findByRole('button', {name: 'Pay Now'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Verify with your bank'})
    ).not.toBeInTheDocument();
    expect(reloadInvoice).not.toHaveBeenCalled();
  });

  it('does not strand the button when handleCardAction rejects', async () => {
    const reloadInvoice = jest.fn();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/${invoice.id}/new/`,
      method: 'GET',
      body: {
        ...intentData,
        clientSecret: 'REJECT',
        requiresAction: true,
        paymentIntentId: 'pi_123abc',
      },
    });

    render(
      <InvoiceDetailsPaymentForm
        organization={organization}
        Header={modalDummy}
        Body={ModalBody}
        closeModal={jest.fn()}
        reloadInvoice={reloadInvoice}
        invoice={invoice}
      />
    );

    await userEvent.click(
      await screen.findByRole('button', {name: 'Verify with your bank'})
    );

    // Not left spinning on "Verifying..." with nothing explaining why.
    expect(await screen.findByText(/did not go through/)).toBeInTheDocument();
  });

  it('surfaces a decline that happens after authentication', async () => {
    const reloadInvoice = jest.fn();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/${invoice.id}/new/`,
      method: 'GET',
      body: {...intentData, requiresAction: true, paymentIntentId: 'pi_123abc'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/${invoice.id}/confirm/`,
      method: 'POST',
      body: {paid: false, failureCode: 'card_declined'},
    });

    render(
      <InvoiceDetailsPaymentForm
        organization={organization}
        Header={modalDummy}
        Body={ModalBody}
        closeModal={jest.fn()}
        reloadInvoice={reloadInvoice}
        invoice={invoice}
      />
    );

    await userEvent.click(
      await screen.findByRole('button', {name: 'Verify with your bank'})
    );

    expect(await screen.findByText(/Your bank declined the payment/)).toBeInTheDocument();
    expect(reloadInvoice).not.toHaveBeenCalled();
  });

  it('renders an error when intent creation fails', async () => {
    const reloadInvoice = jest.fn();
    const mockget = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/${invoice.id}/new/`,
      method: 'GET',
      statusCode: 500,
      body: {detail: 'Something bad happened.'},
    });
    render(
      <InvoiceDetailsPaymentForm
        organization={organization}
        Header={modalDummy}
        Body={ModalBody}
        closeModal={jest.fn()}
        reloadInvoice={reloadInvoice}
        invoice={invoice}
      />
    );

    // Wait for the error message to appear (this also ensures API was called and state updated)
    expect(await screen.findByText(/Something bad happened./)).toBeInTheDocument();
    expect(mockget).toHaveBeenCalled();

    // Submit the form anyways - wait for the button to become enabled
    // (the mock Stripe PaymentElement fires onChange asynchronously via setTimeout)
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Pay Now'})).toBeEnabled()
    );
    await userEvent.click(screen.getByRole('button', {name: 'Pay Now'}));

    // Should show an error as our intent never loaded.
    expect(await screen.findByText(/Cannot complete your payment/)).toBeInTheDocument();
  });

  it('can submit the form', async () => {
    const reloadInvoice = jest.fn();
    const mockget = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/${invoice.id}/new/`,
      method: 'GET',
      body: intentData,
    });
    const mockConfirm = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/${invoice.id}/confirm/`,
      method: 'POST',
      body: {paid: true},
    });
    render(
      <InvoiceDetailsPaymentForm
        organization={organization}
        Header={modalDummy}
        Body={ModalBody}
        closeModal={jest.fn()}
        reloadInvoice={reloadInvoice}
        invoice={invoice}
      />
    );
    await waitFor(() => expect(mockget).toHaveBeenCalled());
    expect(mockget).toHaveBeenCalled();

    expect(await screen.findByText('Pay Bill')).toBeInTheDocument();

    const button = await screen.findByRole('button', {name: 'Pay Now'});
    await userEvent.click(button);
    await waitFor(() => expect(reloadInvoice).toHaveBeenCalled());
    expect(reloadInvoice).toHaveBeenCalled();
    // The charge is confirmed server-side rather than left to the webhook,
    // so the invoice is marked paid before the customer looks at it.
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
  });

  it('still reports success when recording the payment fails', async () => {
    // The money has already moved at this point -- a failure to write it down
    // is ours to chase (the webhook reconciles it), not the customer's.
    const reloadInvoice = jest.fn();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/${invoice.id}/new/`,
      method: 'GET',
      body: intentData,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/${invoice.id}/confirm/`,
      method: 'POST',
      statusCode: 500,
      body: {detail: 'nope'},
    });
    render(
      <InvoiceDetailsPaymentForm
        organization={organization}
        Header={modalDummy}
        Body={ModalBody}
        closeModal={jest.fn()}
        reloadInvoice={reloadInvoice}
        invoice={invoice}
      />
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Pay Now'}));

    await waitFor(() => expect(reloadInvoice).toHaveBeenCalled());
  });
});
