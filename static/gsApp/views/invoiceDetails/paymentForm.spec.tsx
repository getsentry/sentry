import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ModalBody} from 'sentry/components/globalModal/components';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {InvoiceItemType} from 'getsentry/types';
import InvoiceDetailsPaymentForm from 'getsentry/views/invoiceDetails/paymentForm';

jest.mock('getsentry/utils/stripe', () => ({
  loadStripe: (cb: any) => {
    cb(() => ({
      confirmCardPayment: jest.fn(
        () =>
          new Promise(resolve => {
            resolve({error: undefined, paymentIntent: {id: 'pi_123abc'}});
          })
      ),
      elements: jest.fn(() => ({
        create: jest.fn(() => ({
          mount: jest.fn(),
          on(_name: any, handler: any) {
            handler();
          },
          update: jest.fn(),
        })),
      })),
    }));
  },
}));

describe('InvoiceDetails > Payment Form', function () {
  const organization = OrganizationFixture();
  const invoice = InvoiceFixture(
    {
      items: [
        {
          type: InvoiceItemType.SUBSCRIPTION,
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

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    SubscriptionStore.set(organization.slug, {});
    // This should happen automatically, but isn't.
    cleanup();
  });

  const modalDummy = ({children}: {children?: ReactNode}) => <div>{children}</div>;

  it('renders basic a card form', async function () {
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
    expect(screen.getByText('Pay Invoice')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Cancel', hidden: true})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Pay Now', hidden: true})
    ).toBeInTheDocument();
  });

  it('renders an error when intent creation fails', async function () {
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

    expect(screen.getByText('Pay Invoice')).toBeInTheDocument();

    let error = screen.getByText(/Unable to initialize payment/);
    expect(error).toBeInTheDocument();

    // Submit the form anyways
    const postalCode = screen.getByRole('textbox', {name: 'Postal Code'});
    act(() => {
      fireEvent.change(postalCode, {target: {value: '90210'}});
    });
    const button = screen.getByRole('button', {name: 'Pay Now'});
    act(() => {
      fireEvent.click(button);
    });

    // Should show an error as our intent never loaded.
    error = screen.getByText(/Cannot complete your payment/);
    expect(error).toBeInTheDocument();
  });

  it('can submit the form', async function () {
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

    expect(screen.getByText('Pay Invoice')).toBeInTheDocument();

    const postalCode = screen.getByRole('textbox', {name: 'Postal Code'});
    act(() => {
      fireEvent.change(postalCode, {target: {value: '90210'}});
    });
    const button = screen.getByRole('button', {name: 'Pay Now'});
    act(() => {
      fireEvent.click(button);
    });
    await waitFor(() => expect(reloadInvoice).toHaveBeenCalled());
    expect(reloadInvoice).toHaveBeenCalled();
  });
});
