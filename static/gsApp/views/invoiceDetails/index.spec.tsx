import {BillingDetailsFixture} from 'getsentry-test/fixtures/billingDetails';
import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {InvoiceItemType} from 'getsentry/types';
import InvoiceDetails from 'getsentry/views/invoiceDetails';

describe('InvoiceDetails', function () {
  const {organization, router, routerProps} = initializeOrg();
  const basicInvoice = InvoiceFixture(
    {
      dateCreated: '2021-09-20T22:33:38.042Z',
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
  const creditInvoice = InvoiceFixture(
    {
      amount: 8900,
      amountBilled: 8400,
      creditApplied: 500,
      items: [
        {
          type: InvoiceItemType.SUBSCRIPTION,
          description: 'Subscription to Business',
          amount: 8900,
          periodEnd: '2021-10-21',
          periodStart: '2021-09-21',
          data: {},
        },
        {
          type: InvoiceItemType.CREDIT_APPLIED,
          description: 'Credit applied',
          amount: 500,
          periodEnd: '2021-10-21',
          periodStart: '2021-09-21',
          data: {},
        },
      ],
    },
    organization
  );
  const params = {invoiceGuid: basicInvoice.id};

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    SubscriptionStore.set(organization.slug, {});

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: {},
    });
  });

  it('renders basic invoice details', async function () {
    const mockapi = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${basicInvoice.id}/`,
      method: 'GET',
      body: basicInvoice,
    });
    render(
      <InvoiceDetails {...routerProps} params={params} organization={organization} />
    );
    await waitFor(() => expect(mockapi).toHaveBeenCalled());

    expect(await screen.findByText('Sentry')).toBeInTheDocument();
    expect(screen.getByText(/Subscription to Business/)).toBeInTheDocument();
    expect(screen.getByText('Sep 21, 2021')).toBeInTheDocument();
    expect(screen.getByText('Oct 21, 2021')).toBeInTheDocument();
    expect(screen.getByText('Sep 20, 2021')).toBeInTheDocument();
    expect(screen.getByText('$89.00 USD')).toBeInTheDocument();
  });

  it('renders credit applied', async function () {
    const mockapi = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${creditInvoice.id}/`,
      method: 'GET',
      body: creditInvoice,
    });
    const creditParams = {invoiceGuid: creditInvoice.id};
    render(
      <InvoiceDetails
        {...routerProps}
        params={creditParams}
        organization={organization}
      />
    );
    await waitFor(() => expect(mockapi).toHaveBeenCalled());

    expect(await screen.findByText('Sentry')).toBeInTheDocument();
    expect(screen.getByText(/Subscription to Business/)).toBeInTheDocument();
    expect(screen.getByText('$89.00 USD')).toBeInTheDocument();
  });

  it('renders an error', async function () {
    const mockapi = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${basicInvoice.id}/`,
      method: 'GET',
      statusCode: 404,
      body: {},
    });
    render(<InvoiceDetails {...routerProps} params={params} />);
    await waitFor(() => expect(mockapi).toHaveBeenCalled());

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });

  it('sends a request to email the invoice', async function () {
    const mockget = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${basicInvoice.id}/`,
      method: 'GET',
      statusCode: 200,
      body: basicInvoice,
    });
    const mockpost = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${basicInvoice.id}/`,
      method: 'POST',
    });
    render(<InvoiceDetails {...routerProps} params={params} />);
    await waitFor(() => expect(mockget).toHaveBeenCalled());

    const input = await screen.findByPlaceholderText('you@example.com');
    await userEvent.type(input, 'user@example.com');
    const button = screen.getByText('Email Receipt');
    await userEvent.click(button);

    await waitFor(() => expect(mockpost).toHaveBeenCalled());

    expect(mockpost).toHaveBeenCalledWith(
      `/customers/${organization.slug}/invoices/${basicInvoice.id}/`,
      expect.objectContaining({
        data: {op: 'send_receipt', email: 'user@example.com'},
      })
    );
    // Form should be reset.
    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument();
  });

  it('renders with open pay now with billing failure referrer', async function () {
    router.location = {
      ...router.location,
      query: {referrer: 'billing-failure'},
    };

    const pastDueInvoice = InvoiceFixture(
      {
        amount: 8900,
        isClosed: false,
        isPaid: false,
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
    const pastDueParams = {invoiceGuid: pastDueInvoice.id};
    const mockapiInvoice = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${pastDueInvoice.id}/`,
      method: 'GET',
      body: pastDueInvoice,
    });
    const mockapiPayments = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/${pastDueInvoice.id}/new/`,
      method: 'GET',
      body: {},
    });

    renderGlobalModal();
    render(
      <InvoiceDetails
        {...routerProps}
        params={pastDueParams}
        organization={organization}
      />,
      {
        router,
      }
    );

    await waitFor(() => expect(mockapiInvoice).toHaveBeenCalled());
    await waitFor(() => expect(mockapiPayments).toHaveBeenCalled());

    expect(screen.getByText(/Invoice Details/)).toBeInTheDocument();
    expect(screen.getAllByText(/Pay Now/)).toHaveLength(2);
    expect(screen.getByText(/Pay Invoice/)).toBeInTheDocument();
    expect(screen.getByText(/Card Details/)).toBeInTheDocument();
    expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument();
    expect(screen.getByTestId('cancel')).toBeInTheDocument();
    expect(screen.getByTestId('submit')).toBeInTheDocument();
  });

  describe('Invoice Details Attributes', function () {
    const billingDetails = BillingDetailsFixture({taxNumber: '123456789'});
    SubscriptionFixture({organization});

    beforeEach(function () {
      MockApiClient.clearMockResponses();
      SubscriptionStore.set(organization.slug, {});

      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/billing-details/`,
        method: 'GET',
        body: billingDetails,
      });
    });

    it('renders with billing address', async function () {
      const mockInvoice = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/invoices/${basicInvoice.id}/`,
        method: 'GET',
        body: basicInvoice,
      });
      render(<InvoiceDetails {...routerProps} params={params} />);

      await waitFor(() => expect(mockInvoice).toHaveBeenCalled());

      expect(
        await screen.findByText(`${billingDetails.companyName}`)
      ).toBeInTheDocument();
      expect(screen.getByText('Details:')).toBeInTheDocument();
      expect(screen.getByText(`${billingDetails.displayAddress}`)).toBeInTheDocument();
      expect(screen.getByText('Tax Number:')).toBeInTheDocument();
      expect(screen.getByText(`${billingDetails.taxNumber}`)).toBeInTheDocument();
      expect(screen.getByText(`${billingDetails.billingEmail}`)).toBeInTheDocument();
      expect(screen.queryByText('Country Id: 1234')).not.toBeInTheDocument();
      expect(screen.queryByText('Regional Tax Id: 5678')).not.toBeInTheDocument();
    });

    it('renders sentry tax ids', async function () {
      const basicInvoiceWithSentryTaxIds = InvoiceFixture(
        {
          sentryTaxIds: {
            taxId: '1234',
            taxIdName: 'Country Id',
            region: {
              code: 'AA',
              taxId: '5678',
              taxIdName: 'Regional Tax Id',
            },
          },
        },
        organization
      );

      const mockInvoice = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/invoices/${basicInvoiceWithSentryTaxIds.id}/`,
        method: 'GET',
        body: basicInvoiceWithSentryTaxIds,
      });
      render(<InvoiceDetails {...routerProps} params={params} />);

      await waitFor(() => expect(mockInvoice).toHaveBeenCalled());
      expect(await screen.findByText('Country Id: 1234')).toBeInTheDocument();
      expect(screen.getByText('Regional Tax Id: 5678')).toBeInTheDocument();
    });

    it('renders reverse charge row', async function () {
      const basicInvoiceReverseCharge = InvoiceFixture(
        {
          isReverseCharge: true,
          defaultTaxName: 'VAT',
        },
        organization
      );

      const mockInvoice = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/invoices/${basicInvoiceReverseCharge.id}/`,
        method: 'GET',
        body: basicInvoiceReverseCharge,
      });
      render(<InvoiceDetails {...routerProps} params={params} />);

      await waitFor(() => expect(mockInvoice).toHaveBeenCalled());
      expect(await screen.findByText('VAT')).toBeInTheDocument();
      expect(screen.getByText('Reverse Charge')).toBeInTheDocument();
    });
  });
});
