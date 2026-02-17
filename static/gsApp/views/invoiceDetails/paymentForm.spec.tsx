import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ModalBody} from 'sentry/components/globalModal/components';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
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
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Pay Now'})).toBeInTheDocument();
    expect(
      screen.queryByText(
        /, you authorize Sentry to automatically charge you recurring subscription fees and applicable on-demand fees. Recurring charges occur at the start of your selected billing cycle for subscription fees and monthly for on-demand fees. You may cancel your subscription at any time/
      )
    ).not.toBeInTheDocument();
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

    // Submit the form anyways
    expect(screen.getByRole('button', {name: 'Pay Now'})).toBeEnabled();
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

    expect(screen.getByText('Pay Bill')).toBeInTheDocument();

    const button = screen.getByRole('button', {name: 'Pay Now'});
    await userEvent.click(button);
    await waitFor(() => expect(reloadInvoice).toHaveBeenCalled());
    expect(reloadInvoice).toHaveBeenCalled();
  });
});
