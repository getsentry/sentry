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

  it('renders basic a card form', async () => {
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

  it('renders form when Stripe components are enabled', async () => {
    organization.features = ['stripe-components'];
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
      body: {details: 'Something bad happened.'},
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

    let error = screen.getByText(/Unable to initialize payment/);
    expect(error).toBeInTheDocument();

    // Submit the form anyways
    const button = screen.getByRole('button', {name: 'Pay Now'});
    await userEvent.click(button);

    // Should show an error as our intent never loaded.
    error = screen.getByText(/Cannot complete your payment/);
    expect(error).toBeInTheDocument();
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
