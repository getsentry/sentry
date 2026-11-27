import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingDetailsFixture} from 'getsentry-test/fixtures/billingDetails';
import {BillingHistoryFixture} from 'getsentry-test/fixtures/billingHistory';
import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  cleanup,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {DateTimeProvider} from '@sentry/scraps/dateTime';

import {DataCategory} from 'sentry/types/core';
import {DEFAULT_QUERY_CLIENT_CONFIG} from 'sentry/utils/queryClientConfig';

import {PlanFixture} from 'getsentry/__fixtures__/plan';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import InvoiceDetails from 'getsentry/views/invoiceDetails';

describe('InvoiceDetails', () => {
  const {organization} = initializeOrg();
  const basicInvoice = InvoiceFixture(
    {
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
    SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}));

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
    render(
      <DateTimeProvider value={{timezone: 'America/New_York'}}>
        <InvoiceDetails />
      </DateTimeProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      }
    );
    await waitFor(() => expect(mockapi).toHaveBeenCalled());

    expect(await screen.findByText('Sentry')).toBeInTheDocument();
    expect(screen.getByText(/Subscription to Business/)).toBeInTheDocument();
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

    expect(await screen.findByText('Sentry')).toBeInTheDocument();
    expect(screen.getByText(/Subscription to Business/)).toBeInTheDocument();
    expect(screen.getByText('$89.00 USD')).toBeInTheDocument();
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

    expect(await screen.findByText(/AWAITING PAYMENT/)).toBeInTheDocument();
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

    const input = await screen.findByPlaceholderText('you@example.com');
    await userEvent.type(input, 'user@example.com');
    const button = screen.getByText('Email Receipt');
    await userEvent.click(button);

    await waitFor(() => expect(mockpost).toHaveBeenCalled());

    expect(mockpost).toHaveBeenCalledWith(
      `/customers/${organization.slug}/invoices/${basicInvoice.id}/`,
      expect.objectContaining({data: {op: 'send_receipt', email: 'user@example.com'}})
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
      SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}));

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
      expect(screen.getByText('Details:')).toBeInTheDocument();
      expect(screen.getByText(`${billingDetails.displayAddress}`)).toBeInTheDocument();
      expect(screen.getByText(`${billingDetails.billingEmail}`)).toBeInTheDocument();
      expect(screen.queryByText('Tax Number:')).not.toBeInTheDocument();
      expect(screen.queryByText(`${billingDetails.taxNumber}`)).not.toBeInTheDocument();
      expect(screen.queryByText('Country Id: 1234')).not.toBeInTheDocument();
      expect(screen.queryByText('Regional Tax Id: 5678')).not.toBeInTheDocument();
    });

    it('renders sentry tax ids', async () => {
      const basicInvoiceWithSentryTaxIds = InvoiceFixture(
        {
          sentryTaxIds: {
            taxId: '1234',
            taxIdName: 'Country Id',
            region: {code: 'AA', taxId: '5678', taxIdName: 'Regional Tax Id'},
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
        {isReverseCharge: true, defaultTaxName: 'VAT'},
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

  describe('Usage billed on this receipt', () => {
    const usageOrganization = OrganizationFixture({
      features: ['invoice-usage-downloads'],
    });
    const invoiceUrl = `/customers/${organization.slug}/invoices/${basicInvoice.id}/`;
    const usageUrl = `/customers/${organization.slug}/invoices/${basicInvoice.id}/usage/`;

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/invoices/${basicInvoice.id}/`,
        method: 'GET',
        body: basicInvoice,
      });
    });

    it('shows the billed period, the plan and the usage table', async () => {
      MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        // A response with spend fields still shows no spend table.
        body: BillingHistoryFixture({
          plan: 'am1_team',
          periodStart: '2021-08-21',
          periodEnd: '2021-09-20',
          onDemandMaxSpend: 5000,
          onDemandSpend: 838,
          categories: {
            errors: MetricHistoryFixture({
              category: DataCategory.ERRORS,
              usage: 62_000,
              reserved: 50_000,
              prepaid: 50_000,
              onDemandSpendUsed: 838,
            }),
          },
        }),
      });
      render(<InvoiceDetails />, {
        organization: usageOrganization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      const usage = await screen.findByRole('region', {
        name: 'Usage billed on this receipt',
      });
      expect(within(usage).getByText('Aug 21, 2021 - Sep 20, 2021')).toBeInTheDocument();
      expect(within(usage).getByText('Team Plan')).toBeInTheDocument();
      expect(
        within(usage).getByRole('row', {name: 'Errors 62,000 50,000 >100%'})
      ).toBeInTheDocument();
      expect(
        within(usage).queryByRole('columnheader', {name: 'Amount Spent'})
      ).not.toBeInTheDocument();
    });

    it('names the categories from the display names in the plan details', async () => {
      MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        body: {
          ...BillingHistoryFixture({
            plan: 'am3_team',
            categories: {
              errors: MetricHistoryFixture({
                category: DataCategory.ERRORS,
                usage: 62_000,
                reserved: 50_000,
                prepaid: 50_000,
              }),
            },
          }),
          // The endpoint sends only the display names of the plan.
          planDetails: {
            categoryDisplayNames: {
              errors: {singular: 'error event', plural: 'error events'},
            },
          },
        },
      });
      render(<InvoiceDetails />, {
        organization: usageOrganization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      const usage = await screen.findByRole('region', {
        name: 'Usage billed on this receipt',
      });
      expect(
        within(usage).getByRole('row', {name: 'Error events 62,000 50,000 >100%'})
      ).toBeInTheDocument();
    });

    it('shows no usage when the receipt billed none', async () => {
      const usageRequest = MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        statusCode: 404,
        body: {detail: 'This receipt billed no usage.'},
      });
      render(<InvoiceDetails />, {
        organization: usageOrganization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      await waitFor(() => expect(usageRequest).toHaveBeenCalled());
      // Let the page render the response before checking that it shows nothing.
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));
      expect(screen.getByText(/Subscription to Business/)).toBeInTheDocument();
      expect(
        screen.queryByRole('region', {name: 'Usage billed on this receipt'})
      ).not.toBeInTheDocument();
    });

    it('shows no usage when the period has no usage rows', async () => {
      const {
        categories: _categories,
        planDetails: _planDetails,
        ...usageBody
      } = BillingHistoryFixture();
      const usageRequest = MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        body: usageBody,
      });
      render(<InvoiceDetails />, {
        organization: usageOrganization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      await waitFor(() => expect(usageRequest).toHaveBeenCalled());
      // Let the page render the response before checking that it shows nothing.
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));
      expect(screen.getByText(/Subscription to Business/)).toBeInTheDocument();
      expect(
        screen.queryByRole('region', {name: 'Usage billed on this receipt'})
      ).not.toBeInTheDocument();
    });

    it('does not request the usage without the feature', async () => {
      const usageRequest = MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        body: BillingHistoryFixture(),
      });
      render(<InvoiceDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      expect(await screen.findByText(/Subscription to Business/)).toBeInTheDocument();
      expect(usageRequest).not.toHaveBeenCalled();
      expect(
        screen.queryByRole('region', {name: 'Usage billed on this receipt'})
      ).not.toBeInTheDocument();
    });

    it('retries the usage after a server error', async () => {
      const usageRequest = MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        statusCode: 500,
        body: {},
      });
      render(<InvoiceDetails />, {
        organization: usageOrganization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      const usage = await screen.findByRole('region', {
        name: 'Usage billed on this receipt',
      });
      expect(
        within(usage).getByText('There was an error loading data.')
      ).toBeInTheDocument();
      await userEvent.click(within(usage).getByRole('button', {name: 'Retry'}));
      await waitFor(() => expect(usageRequest).toHaveBeenCalledTimes(2));
    });

    it('offers no retry when the usage is forbidden', async () => {
      MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        statusCode: 403,
        body: {},
      });
      render(<InvoiceDetails />, {
        organization: usageOrganization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      const usage = await screen.findByRole('region', {
        name: 'Usage billed on this receipt',
      });
      expect(
        within(usage).getByText('There was an error loading data.')
      ).toBeInTheDocument();
      expect(
        within(usage).queryByRole('button', {name: 'Retry'})
      ).not.toBeInTheDocument();
    });

    it('requests the usage while the receipt loads', async () => {
      const receiptResponse = Promise.withResolvers<void>();
      const invoiceRequest = MockApiClient.addMockResponse({
        url: invoiceUrl,
        method: 'GET',
        body: basicInvoice,
        asyncDelay: receiptResponse.promise,
      });
      const usageRequest = MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        statusCode: 404,
        body: {},
      });
      render(<InvoiceDetails />, {
        organization: usageOrganization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      // The receipt response is held, so the usage request must not wait for it.
      await waitFor(() => expect(usageRequest).toHaveBeenCalled());
      expect(invoiceRequest).toHaveBeenCalled();
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

      receiptResponse.resolve();
      expect(await screen.findByText(/Subscription to Business/)).toBeInTheDocument();
    });

    it('shows the usage only after the receipt loads', async () => {
      const receiptResponse = Promise.withResolvers<void>();
      MockApiClient.addMockResponse({
        url: invoiceUrl,
        method: 'GET',
        body: basicInvoice,
        asyncDelay: receiptResponse.promise,
      });
      const usageRequest = MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        body: BillingHistoryFixture(),
      });
      render(<InvoiceDetails />, {
        organization: usageOrganization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      await waitFor(() => expect(usageRequest).toHaveBeenCalled());
      // Let the page render the usage response before the receipt arrives.
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      expect(
        screen.queryByRole('region', {name: 'Usage billed on this receipt'})
      ).not.toBeInTheDocument();

      receiptResponse.resolve();
      expect(
        await screen.findByRole('region', {name: 'Usage billed on this receipt'})
      ).toBeInTheDocument();
      expect(screen.getByText(/Subscription to Business/)).toBeInTheDocument();
    });

    it('keeps the section with a spinner while Retry runs', async () => {
      MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        statusCode: 500,
        body: {},
      });
      render(<InvoiceDetails />, {
        organization: usageOrganization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      const usage = await screen.findByRole('region', {
        name: 'Usage billed on this receipt',
      });
      const retryResponse = Promise.withResolvers<void>();
      MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        body: BillingHistoryFixture(),
        asyncDelay: retryResponse.promise,
      });
      await userEvent.click(within(usage).getByRole('button', {name: 'Retry'}));

      expect(await within(usage).findByTestId('loading-indicator')).toBeInTheDocument();
      expect(screen.getByRole('region', {name: 'Usage billed on this receipt'})).toBe(
        usage
      );

      retryResponse.resolve();
      expect(await screen.findByText('Jan 1, 2018 - Jan 31, 2018')).toBeInTheDocument();
    });

    it('shows no spinner when the page opens a 404 receipt again', async () => {
      const otherInvoice = InvoiceFixture({id: 'other-receipt'}, organization);
      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/invoices/${otherInvoice.id}/`,
        method: 'GET',
        body: otherInvoice,
      });
      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/invoices/${otherInvoice.id}/usage/`,
        method: 'GET',
        body: BillingHistoryFixture(),
      });
      const usageRequest = MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        statusCode: 404,
        body: {},
      });
      const {router} = render(<InvoiceDetails />, {
        organization: usageOrganization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });
      await waitFor(() => expect(usageRequest).toHaveBeenCalled());

      router.navigate(`/organizations/${organization.slug}/invoices/${otherInvoice.id}/`);
      expect(
        await screen.findByRole('region', {name: 'Usage billed on this receipt'})
      ).toBeInTheDocument();

      // The query cache keeps the 404, and the page requests the usage again.
      router.navigate(`/organizations/${organization.slug}/invoices/${basicInvoice.id}/`);
      expect(
        screen.queryByRole('region', {name: 'Usage billed on this receipt'})
      ).not.toBeInTheDocument();
      await waitFor(() => expect(usageRequest).toHaveBeenCalledTimes(2));
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));
      expect(
        screen.queryByRole('region', {name: 'Usage billed on this receipt'})
      ).not.toBeInTheDocument();
    });

    it('says that the receipt billed no usage when Retry gets a 404', async () => {
      MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        statusCode: 500,
        body: {},
      });
      render(<InvoiceDetails />, {
        organization: usageOrganization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });

      const usage = await screen.findByRole('region', {
        name: 'Usage billed on this receipt',
      });
      MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        statusCode: 404,
        body: {},
      });
      await userEvent.click(within(usage).getByRole('button', {name: 'Retry'}));

      expect(
        await screen.findByText('This receipt billed no usage.')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('region', {name: 'Usage billed on this receipt'})
      ).toHaveTextContent('This receipt billed no usage.');
    });

    it('does not carry a Retry over to the next receipt', async () => {
      const otherInvoice = InvoiceFixture({id: 'other-receipt'}, organization);
      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/invoices/${otherInvoice.id}/`,
        method: 'GET',
        body: otherInvoice,
      });
      const otherUsageRequest = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/invoices/${otherInvoice.id}/usage/`,
        method: 'GET',
        statusCode: 404,
        body: {},
      });
      MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        statusCode: 500,
        body: {},
      });
      const {router} = render(<InvoiceDetails />, {
        organization: usageOrganization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
          },
          route: '/organizations/:orgId/invoices/:invoiceGuid/',
        },
      });
      const usage = await screen.findByRole('region', {
        name: 'Usage billed on this receipt',
      });
      MockApiClient.addMockResponse({
        url: usageUrl,
        method: 'GET',
        statusCode: 404,
        body: {},
      });
      await userEvent.click(within(usage).getByRole('button', {name: 'Retry'}));
      expect(
        await screen.findByText('This receipt billed no usage.')
      ).toBeInTheDocument();

      // The next receipt's first answer is a 404, with no failure before it.
      router.navigate(`/organizations/${organization.slug}/invoices/${otherInvoice.id}/`);
      await waitFor(() => expect(otherUsageRequest).toHaveBeenCalled());
      // Let the page render the response before checking that it shows nothing.
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));
      expect(
        screen.queryByRole('region', {name: 'Usage billed on this receipt'})
      ).not.toBeInTheDocument();
    });

    describe('with the app query client', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(async () => {
        try {
          cleanup();
          await act(() => jest.runOnlyPendingTimersAsync());
        } finally {
          jest.useRealTimers();
        }
      });

      it('shows a spinner in the section during the automatic retries', async () => {
        const usageRequest = MockApiClient.addMockResponse({
          url: usageUrl,
          method: 'GET',
          statusCode: 500,
          body: {},
        });
        // The app's query client retries a server error 3 times, after 1, 2 and 4 s.
        render(
          <QueryClientProvider client={new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG)}>
            <InvoiceDetails />
          </QueryClientProvider>,
          {
            organization: usageOrganization,
            initialRouterConfig: {
              location: {
                pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
              },
              route: '/organizations/:orgId/invoices/:invoiceGuid/',
            },
          }
        );

        const usage = await screen.findByRole('region', {
          name: 'Usage billed on this receipt',
        });
        expect(within(usage).getByTestId('loading-indicator')).toBeInTheDocument();

        await act(() => jest.advanceTimersByTimeAsync(7_000));
        expect(usageRequest).toHaveBeenCalledTimes(4);
        expect(
          within(usage).getByText('There was an error loading data.')
        ).toBeInTheDocument();
      });

      it('says that the receipt billed no usage when a retry gets a 404', async () => {
        MockApiClient.addMockResponse({
          url: usageUrl,
          method: 'GET',
          statusCode: 500,
          body: {},
        });
        render(
          <QueryClientProvider client={new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG)}>
            <InvoiceDetails />
          </QueryClientProvider>,
          {
            organization: usageOrganization,
            initialRouterConfig: {
              location: {
                pathname: `/organizations/${organization.slug}/invoices/${params.invoiceGuid}/`,
              },
              route: '/organizations/:orgId/invoices/:invoiceGuid/',
            },
          }
        );
        const usage = await screen.findByRole('region', {
          name: 'Usage billed on this receipt',
        });
        expect(within(usage).getByTestId('loading-indicator')).toBeInTheDocument();
        const usageNotFound = MockApiClient.addMockResponse({
          url: usageUrl,
          method: 'GET',
          statusCode: 404,
          body: {},
        });

        // The automatic retry after 1 s gets the 404.
        await act(() => jest.advanceTimersByTimeAsync(1_000));
        expect(usageNotFound).toHaveBeenCalledTimes(1);
        expect(
          screen.getByRole('region', {name: 'Usage billed on this receipt'})
        ).toHaveTextContent('This receipt billed no usage.');
      });
    });
  });
});
