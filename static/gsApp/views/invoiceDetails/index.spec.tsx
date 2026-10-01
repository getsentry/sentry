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

import {PlanFixture} from 'getsentry/__fixtures__/plan';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import InvoiceDetails from 'getsentry/views/invoiceDetails';

describe('InvoiceDetails', () => {
  const {organization} = initializeOrg();
  const basicInvoice = InvoiceFixture(
    {
      amountBilled: 8900,
      dateCreated: '2021-09-20T22:33:38.042Z',
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
  const creditInvoice = InvoiceFixture(
    {
      amount: 8900,
      amountBilled: 8400,
      creditApplied: 500,
      items: [
        {
          type: 'subscription',
          description: 'Subscription to Business',
          amount: 8900,
          periodEnd: '2021-10-21',
          periodStart: '2021-09-21',
          data: {},
        },
        {
          type: 'credit_applied',
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

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    SubscriptionStore.set(organization.slug, {});

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders basic invoice details', async () => {
    const mockapi = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${basicInvoice.id}/`,
      method: 'GET',
      body: basicInvoice,
    });
    render(<InvoiceDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
        },
        route: '/organizations/:orgId/invoices/:invoiceGuid/',
      },
    });
    await waitFor(() => expect(mockapi).toHaveBeenCalled());

    expect(await screen.findByRole('cell', {name: 'Business Plan'})).toBeInTheDocument();
    expect(screen.getByText('Receipt ID')).toBeInTheDocument();
    expect(screen.getByText(basicInvoice.id)).toBeInTheDocument();
    expect(screen.getByText('Paid in full')).toBeInTheDocument();
    expect(screen.getByText('Sep 21, 2021')).toBeInTheDocument();
    expect(screen.getByText('Oct 21, 2021')).toBeInTheDocument();
    expect(screen.getByText('Sep 20, 2021')).toBeInTheDocument();
    expect(screen.getByText('$89.00 USD')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Your subscription will automatically renew on or about the same day each month and your credit card on file will be charged the recurring subscription fees set forth above. In addition to recurring subscription fees, you may also be charged for monthly on-demand fees. You may cancel your subscription at any time /
      )
    ).toBeInTheDocument();
  });

  it('renders disclaimer with annual billing', async () => {
    const annualInvoice = InvoiceFixture(
      {
        customer: SubscriptionFixture({
          organization,
          billingInterval: 'annual',
          planDetails: PlanFixture({budgetTerm: 'pay-as-you-go'}),
        }),
      },
      organization
    );
    const mockapi = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${annualInvoice.id}/`,
      method: 'GET',
      body: annualInvoice,
    });
    render(<InvoiceDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
        },
        route: '/organizations/:orgId/invoices/:invoiceGuid/',
      },
    });
    await waitFor(() => expect(mockapi).toHaveBeenCalled());

    expect(
      await screen.findByText(
        /Your subscription will automatically renew on or about the same day each year and your credit card on file will be charged the recurring subscription fees set forth above. In addition to recurring subscription fees, you may also be charged for monthly pay-as-you-go fees. You may cancel your subscription at any time /
      )
    ).toBeInTheDocument();
  });

  it('renders credit applied', async () => {
    const mockapi = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${creditInvoice.id}/`,
      method: 'GET',
      body: creditInvoice,
    });
    const creditParams = {invoiceGuid: creditInvoice.id};
    render(<InvoiceDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/invoices/${creditParams.invoiceGuid}/`,
        },
        route: '/organizations/:orgId/invoices/:invoiceGuid/',
      },
    });
    await waitFor(() => expect(mockapi).toHaveBeenCalled());

    expect(await screen.findByRole('cell', {name: 'Business Plan'})).toBeInTheDocument();
    expect(screen.getByText('Credit applied')).toBeInTheDocument();
    expect(screen.getByText('$84.00 USD')).toBeInTheDocument();
  });

  it('formats reserved quantities in the units customers buy', async () => {
    const period = {periodStart: '2021-09-21', periodEnd: '2022-09-20'};
    const reservedInvoice = InvoiceFixture(
      {
        items: [
          {
            type: 'reserved_errors',
            description: '50,000 reserved errors',
            amount: 0,
            data: {quantity: 50_000},
            ...period,
          },
          {
            type: 'reserved_attachments',
            description: '25 GB reserved attachments',
            amount: 6500,
            data: {quantity: 25_000_000_000},
            ...period,
          },
          {
            type: 'reserved_profile_duration_ui',
            description: 'Reserved UI profile hours',
            amount: 0,
            data: {quantity: 360_000_000},
            ...period,
          },
          {
            type: 'reserved_profile_duration',
            description: 'Reserved continuous profile hours',
            amount: 0,
            data: {quantity: 0},
            ...period,
          },
        ],
      },
      organization
    );
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${reservedInvoice.id}/`,
      method: 'GET',
      body: reservedInvoice,
    });
    render(<InvoiceDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/invoices/${reservedInvoice.id}/`,
        },
        route: '/organizations/:orgId/invoices/:invoiceGuid/',
      },
    });

    expect(
      await screen.findByRole('row', {name: 'Reserved errors 50,000 $0.00'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Reserved attachments 25 GB $65.00'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Reserved UI profile hours 100 $0.00'})
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Reserved continuous profile hours')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', {name: 'Rate'})).not.toBeInTheDocument();
  });

  it('renders refunds and the net amount paid', async () => {
    const refundedInvoice = InvoiceFixture(
      {amountBilled: 6500, amountRefunded: 6500, isRefunded: true},
      organization
    );
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${refundedInvoice.id}/`,
      method: 'GET',
      body: refundedInvoice,
    });
    render(<InvoiceDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/invoices/${refundedInvoice.id}/`,
        },
        route: '/organizations/:orgId/invoices/:invoiceGuid/',
      },
    });

    expect(await screen.findByText('Refunded')).toBeInTheDocument();
    expect(screen.queryByText('Paid in full')).not.toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Refunds -$65.00'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Net paid $0.00'})).toBeInTheDocument();
  });

  it('renders partially refunded invoices', async () => {
    const refundedInvoice = InvoiceFixture(
      {amountBilled: 6500, amountRefunded: 1500, isRefunded: true},
      organization
    );
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${refundedInvoice.id}/`,
      method: 'GET',
      body: refundedInvoice,
    });
    render(<InvoiceDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/invoices/${refundedInvoice.id}/`,
        },
        route: '/organizations/:orgId/invoices/:invoiceGuid/',
      },
    });

    expect(await screen.findByText('Partially refunded')).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Net paid $50.00'})).toBeInTheDocument();
  });

  it('renders closed unpaid invoices as closed', async () => {
    const closedInvoice = InvoiceFixture({isPaid: false, isClosed: true}, organization);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${closedInvoice.id}/`,
      method: 'GET',
      body: closedInvoice,
    });
    render(<InvoiceDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/invoices/${closedInvoice.id}/`,
        },
        route: '/organizations/:orgId/invoices/:invoiceGuid/',
      },
    });

    expect(await screen.findByText('Closed')).toBeInTheDocument();
    expect(screen.queryByText('Waiting for payment')).not.toBeInTheDocument();
    expect(screen.queryByText('Pay Now')).not.toBeInTheDocument();
  });

  it('renders an error', async () => {
    const mockapi = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${basicInvoice.id}/`,
      method: 'GET',
      statusCode: 404,
      body: {},
    });
    render(<InvoiceDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
        },
        route: '/organizations/:orgId/invoices/:invoiceGuid/',
      },
    });
    await waitFor(() => expect(mockapi).toHaveBeenCalled());

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });

  it('renders without pay now for self serve partner', async () => {
    const pastDueInvoice = InvoiceFixture(
      {
        amount: 8900,
        isClosed: false,
        isPaid: false,
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

    pastDueInvoice.customer = SubscriptionFixture({
      organization,
      isSelfServePartner: true,
    });

    const pastDueParams = {invoiceGuid: pastDueInvoice.id};
    const mockapiInvoice = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${pastDueInvoice.id}/`,
      method: 'GET',
      body: pastDueInvoice,
    });

    render(<InvoiceDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/invoices/${pastDueParams.invoiceGuid}/`,
          query: {referrer: 'billing-failure'},
        },
        route: '/organizations/:orgId/invoices/:invoiceGuid/',
      },
    });

    await waitFor(() => expect(mockapiInvoice).toHaveBeenCalled());

    expect(await screen.findByText(/Receipt Details/)).toBeInTheDocument();
    expect(await screen.findByText('Waiting for payment')).toBeInTheDocument();
    expect(screen.queryByText(/Pay Now/)).not.toBeInTheDocument();
  });

  it('sends a request to email the invoice', async () => {
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
    render(<InvoiceDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
        },
        route: '/organizations/:orgId/invoices/:invoiceGuid/',
      },
    });
    await waitFor(() => expect(mockget).toHaveBeenCalled());

    const input = await screen.findByRole('textbox', {name: 'Email address'});
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

  it('renders with open pay now with billing failure referrer', async () => {
    const pastDueInvoice = InvoiceFixture(
      {
        amount: 8900,
        isClosed: false,
        isPaid: false,
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
    render(<InvoiceDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/invoices/${pastDueParams.invoiceGuid}/`,
          query: {referrer: 'billing-failure'},
        },
        route: '/organizations/:orgId/invoices/:invoiceGuid/',
      },
    });

    await waitFor(() => expect(mockapiInvoice).toHaveBeenCalled());
    await waitFor(() => expect(mockapiPayments).toHaveBeenCalled());

    expect(await screen.findByText(/Receipt Details/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/Pay Now/)).toHaveLength(2));
    expect(screen.getByText(/Pay Bill/)).toBeInTheDocument();
    expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });

  describe('Invoice Details Attributes', () => {
    const billingDetails = BillingDetailsFixture({taxNumber: '123456789'});
    SubscriptionFixture({organization});

    beforeEach(() => {
      MockApiClient.clearMockResponses();
      SubscriptionStore.set(organization.slug, {});

      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/billing-details/`,
        method: 'GET',
        body: billingDetails,
      });
      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/invoices/`,
        method: 'GET',
        body: [],
      });
    });

    it('renders with billing address', async () => {
      const mockInvoice = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/invoices/${basicInvoice.id}/`,
        method: 'GET',
        body: basicInvoice,
      });
      render(<InvoiceDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      await waitFor(() => expect(mockInvoice).toHaveBeenCalled());

      expect(
        await screen.findByText(`${billingDetails.companyName}`)
      ).toBeInTheDocument();
      expect(screen.getByText('Billed to')).toBeInTheDocument();
      expect(screen.getByText('123 Street')).toBeInTheDocument();
      expect(screen.getByText('San Francisco, CA 12345')).toBeInTheDocument();
      expect(screen.getByText('United States')).toBeInTheDocument();
      expect(
        screen.queryByText(`${billingDetails.displayAddress}`)
      ).not.toBeInTheDocument();
      expect(screen.getByText(`${billingDetails.billingEmail}`)).toBeInTheDocument();
      expect(screen.queryByText('Tax Number:')).not.toBeInTheDocument();
      expect(screen.queryByText(`${billingDetails.taxNumber}`)).not.toBeInTheDocument();
      expect(screen.queryByText('Country Id: 1234')).not.toBeInTheDocument();
      expect(screen.queryByText('Regional Tax Id: 5678')).not.toBeInTheDocument();
    });

    it('renders the customer tax number', async () => {
      const taxInvoice = InvoiceFixture({taxNumber: '123456789'}, organization);
      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/invoices/${taxInvoice.id}/`,
        method: 'GET',
        body: taxInvoice,
      });
      render(<InvoiceDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${taxInvoice.id}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      // billingDetails is in the US, which has no special tax label
      expect(await screen.findByText('Tax Number: 123456789')).toBeInTheDocument();
    });

    it('renders sentry tax ids', async () => {
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
      render(<InvoiceDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      await waitFor(() => expect(mockInvoice).toHaveBeenCalled());
      expect(await screen.findByText('Country Id: 1234')).toBeInTheDocument();
      expect(screen.getByText('Regional Tax Id: 5678')).toBeInTheDocument();
    });

    it('renders reverse charge row', async () => {
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
      render(<InvoiceDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      await waitFor(() => expect(mockInvoice).toHaveBeenCalled());
      expect(await screen.findByText('VAT')).toBeInTheDocument();
      expect(screen.getByText('Reverse Charge')).toBeInTheDocument();
    });
  });
});
