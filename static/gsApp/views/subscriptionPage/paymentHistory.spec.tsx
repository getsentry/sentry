import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {BillingHistoryFixture} from 'getsentry-test/fixtures/billingHistory';
import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {PlanTier} from 'getsentry-test/planTier';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import {OnDemandBudgetMode} from 'getsentry/types';
import PaymentHistory from 'getsentry/views/subscriptionPage/paymentHistory';

describe('Subscription > PaymentHistory', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/customers/dogz-rule/billing-config/',
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM1),
    });
    MockApiClient.addMockResponse({
      url: '/customers/dogz-rule/recurring-credits/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/dogz-rule/prompts-activity/',
      body: {},
    });
  });

  it('renders no receipts found', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [],
    });

    render(<PaymentHistory />, {organization});

    expect(await screen.findByText('No receipts found')).toBeInTheDocument();
  });

  it('renders an error for non-billing users', async () => {
    const organization = OrganizationFixture({slug: 'dogz-rule', access: []});
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      body: [],
    });
    const invoicesRequest = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      statusCode: 403,
      body: {},
    });

    render(<PaymentHistory />, {organization});

    expect(await screen.findByTestId('permission-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('payment-list')).not.toBeInTheDocument();
    expect(invoicesRequest).not.toHaveBeenCalled();
  });

  it('renders unpaid invoice', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [InvoiceFixture({isClosed: true, isPaid: false})],
    });

    render(<PaymentHistory />, {organization});

    expect(await screen.findByText('Closed')).toBeInTheDocument();
  });

  it('renders awaiting payment invoice', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [InvoiceFixture({isClosed: false, isPaid: false})],
    });

    render(<PaymentHistory />, {organization});

    expect(await screen.findByText('Awaiting payment')).toBeInTheDocument();
  });

  it('renders paid invoice', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [InvoiceFixture({isClosed: true, isPaid: true})],
    });
    render(<PaymentHistory />, {organization});

    expect(await screen.findByText('Paid')).toBeInTheDocument();
  });

  it('renders receipts as table rows', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
      features: ['token-billed-seer-enabled'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [
        InvoiceFixture({
          amountBilled: 12000,
          amountRefunded: 2000,
          receipt: {url: 'https://example.com/receipt.pdf'},
          receiptType: 'seer_token',
        }),
      ],
    });

    render(<PaymentHistory />, {organization});

    const table = await screen.findByRole('table', {name: 'Receipts'});
    const row = await within(table).findByRole('row', {name: /^Jun 25, 2018/});

    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual(['Date', 'Type', 'Amount', 'Status', 'Receipt ID', '']);
    expect(
      within(row)
        .getAllByRole('cell')
        .map(cell => cell.textContent)
    ).toEqual([
      'Jun 25, 2018',
      'Seer auto-reload',
      '$120$20 refunded',
      'Refunded',
      '1a2c3b4d5e6f',
      '',
    ]);
    expect(within(row).getByRole('link', {name: 'Jun 25, 2018'})).toHaveAttribute(
      'href',
      '/settings/dogz-rule/billing/receipts/1a2c3b4d5e6f/'
    );
    expect(within(row).getByRole('button', {name: 'Download PDF'})).toHaveAttribute(
      'href',
      'https://example.com/receipt.pdf'
    );
  });

  it('labels pay-as-you-go receipts', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
      features: ['token-billed-seer-enabled'],
    });
    const subscription = SubscriptionFixture({organization, plan: 'am3_team'});
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [InvoiceFixture({receiptType: 'payg'})],
    });

    render(<PaymentHistory />, {organization});

    const paygRow = await screen.findByRole('row', {name: /^Jun 25, 2018/});
    expect(within(paygRow).getByText('Pay-as-you-go')).toBeInTheDocument();
  });

  it('leaves out the receipt type without token-billed Seer', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [InvoiceFixture({receiptType: 'seer_token'})],
    });

    render(<PaymentHistory />, {organization});

    const table = await screen.findByRole('table', {name: 'Receipts'});
    await within(table).findByRole('row', {name: /^Jun 25, 2018/});
    expect(
      within(table).queryByRole('columnheader', {name: 'Type'})
    ).not.toBeInTheDocument();
    expect(within(table).queryByText('Seer auto-reload')).not.toBeInTheDocument();
  });

  it('retries loading receipts when the request fails', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    const invoicesRequest = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      statusCode: 500,
      body: {},
    });

    render(<PaymentHistory />, {organization});
    await userEvent.click(await screen.findByRole('button', {name: 'Retry'}));

    expect(invoicesRequest).toHaveBeenCalledTimes(2);
  });

  it('renders usage CSV downloads for platform contract receipts', async () => {
    window.open = jest.fn();
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
      features: ['invoice-usage-downloads'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);
    ProjectsStore.loadInitialData([ProjectFixture({slug: 'my-project'})]);

    const csv = 'https://sentry.io/organizations/dogz-rule/billing/contracts/1/export/';
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [
        InvoiceFixture({
          isClosed: true,
          isPaid: true,
          usageCsvLinks: {csv, csvPerProject: `${csv}per-project/`},
        }),
      ],
    });

    render(<PaymentHistory />, {organization});

    expect(
      await screen.findByRole('button', {name: 'Download Usage CSV'})
    ).toHaveAttribute('href', csv);

    await userEvent.click(
      screen.getByRole('button', {name: 'Download Project Usage CSV'})
    );
    await userEvent.click(screen.getByRole('option', {name: 'my-project'}));
    expect(window.open).toHaveBeenCalledWith(`${csv}per-project/my-project/`, '_blank');
  });

  it('puts the expand column first when usage downloads are on', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
      features: ['invoice-usage-downloads', 'token-billed-seer-enabled'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    const csv = 'https://sentry.io/organizations/dogz-rule/billing/contracts/1/export/';
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [
        InvoiceFixture({
          amountBilled: 12000,
          amountRefunded: 2000,
          receiptType: 'seer_token',
          usageCsvLinks: {csv, csvPerProject: `${csv}per-project/`},
        }),
      ],
    });

    render(<PaymentHistory />, {organization});

    const table = await screen.findByRole('table', {name: 'Receipts'});
    const row = await within(table).findByRole('row', {name: /1a2c3b4d5e6f/});
    const cells = within(row).getAllByRole('cell');

    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual(['', 'Date', 'Type', 'Amount', 'Status', 'Receipt ID', '']);
    expect(
      within(cells[0]!).getByRole('button', {name: 'Usage for the Jun 25, 2018 receipt'})
    ).toBeInTheDocument();
    expect(cells.map(cell => cell.textContent)).toEqual([
      '',
      'Jun 25, 2018',
      'Seer auto-reload',
      '$120$20 refunded',
      'Refunded',
      '1a2c3b4d5e6f',
      '',
    ]);
  });

  it('shows the usage that a receipt billed when its row is expanded', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
      features: ['invoice-usage-downloads'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    const csv = 'https://sentry.io/organizations/dogz-rule/billing/contracts/1/export/';
    const invoice = InvoiceFixture({
      isClosed: true,
      isPaid: true,
      usageCsvLinks: {csv, csvPerProject: `${csv}per-project/`},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [invoice],
    });
    const usageRequest = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${invoice.id}/usage/`,
      method: 'GET',
      body: BillingHistoryFixture({
        plan: 'am3_team',
        isCurrent: false,
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        onDemandMaxSpend: 10_000,
        onDemandSpend: 2_500,
        onDemandBudgetMode: OnDemandBudgetMode.SHARED,
        categories: {
          errors: MetricHistoryFixture({
            usage: 30_000,
            reserved: 50_000,
            free: 10_000,
            prepaid: 60_000,
            onDemandSpendUsed: 2_500,
          }),
        },
      }),
    });

    render(<PaymentHistory />, {organization});

    const usageButton = await screen.findByRole('button', {
      name: 'Usage for the Jun 25, 2018 receipt',
    });
    expect(usageButton).toHaveAttribute('aria-expanded', 'false');
    expect(usageButton).not.toHaveAttribute('aria-controls');
    expect(usageRequest).not.toHaveBeenCalled();

    await userEvent.click(usageButton);

    expect(await screen.findByText('Team Plan')).toBeInTheDocument();
    expect(usageButton).toHaveAttribute('aria-expanded', 'true');
    const usageRow = screen.getByRole('row', {
      name: /^Oct 1, 2026 - Oct 31, 2026 Team Plan/,
    });
    expect(usageRow).toHaveAttribute('id', usageButton.getAttribute('aria-controls'));
    expect(
      screen.getByRole('row', {name: 'Type Accepted Reserved Gifted Used (%)'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Errors 30,000 50,000 10,000 50%'})
    ).toBeInTheDocument();
    // The body has spend fields, and the receipt still shows no spend.
    expect(screen.queryByRole('columnheader', {name: /Spend/})).not.toBeInTheDocument();
    expect(usageRequest).toHaveBeenCalledTimes(1);

    await userEvent.click(usageButton);
    expect(usageButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Team Plan')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('row', {name: 'Type Accepted Reserved Gifted Used (%)'})
    ).not.toBeInTheDocument();

    // A billed period does not change, so expanding again reads the cache.
    await userEvent.click(usageButton);
    expect(await screen.findByText('Team Plan')).toBeInTheDocument();
    expect(usageRequest).toHaveBeenCalledTimes(1);
  });

  it('says when a receipt has no usage details', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
      features: ['invoice-usage-downloads'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    const csv = 'https://sentry.io/organizations/dogz-rule/billing/contracts/1/export/';
    const invoice = InvoiceFixture({
      isClosed: true,
      isPaid: true,
      usageCsvLinks: {csv, csvPerProject: `${csv}per-project/`},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [invoice],
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${invoice.id}/usage/`,
      method: 'GET',
      statusCode: 404,
      body: {detail: 'The requested resource does not exist'},
    });

    render(<PaymentHistory />, {organization});
    await userEvent.click(
      await screen.findByRole('button', {name: 'Usage for the Jun 25, 2018 receipt'})
    );

    expect(
      await screen.findByText('Usage details are not available for this receipt.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
  });

  it('says when a legacy period has no usage categories', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
      features: ['invoice-usage-downloads'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    const csv = 'https://sentry.io/organizations/dogz-rule/billing/history/1/export/';
    const invoice = InvoiceFixture({
      isClosed: true,
      isPaid: true,
      usageCsvLinks: {csv, csvPerProject: `${csv}per-project/`},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [invoice],
    });
    // The legacy serializer leaves out categories and planDetails without metric rows.
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${invoice.id}/usage/`,
      method: 'GET',
      body: {...BillingHistoryFixture(), categories: undefined, planDetails: undefined},
    });

    render(<PaymentHistory />, {organization});
    await userEvent.click(
      await screen.findByRole('button', {name: 'Usage for the Jun 25, 2018 receipt'})
    );

    expect(
      await screen.findByText('Usage details are not available for this receipt.')
    ).toBeInTheDocument();
    expect(screen.getByRole('table', {name: 'Receipts'})).toBeInTheDocument();
  });

  it('offers no retry when retrying the usage request cannot help', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
      features: ['invoice-usage-downloads'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    const csv = 'https://sentry.io/organizations/dogz-rule/billing/contracts/1/export/';
    const invoice = InvoiceFixture({
      isClosed: true,
      isPaid: true,
      usageCsvLinks: {csv, csvPerProject: `${csv}per-project/`},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [invoice],
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${invoice.id}/usage/`,
      method: 'GET',
      statusCode: 403,
      body: {},
    });

    render(<PaymentHistory />, {organization});
    await userEvent.click(
      await screen.findByRole('button', {name: 'Usage for the Jun 25, 2018 receipt'})
    );

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
  });

  it('retries loading the usage of a receipt when the request fails', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
      features: ['invoice-usage-downloads'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    const csv = 'https://sentry.io/organizations/dogz-rule/billing/contracts/1/export/';
    const invoice = InvoiceFixture({
      isClosed: true,
      isPaid: true,
      usageCsvLinks: {csv, csvPerProject: `${csv}per-project/`},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [invoice],
    });
    const usageRequest = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/${invoice.id}/usage/`,
      method: 'GET',
      statusCode: 500,
      body: {},
    });

    render(<PaymentHistory />, {organization});
    await userEvent.click(
      await screen.findByRole('button', {name: 'Usage for the Jun 25, 2018 receipt'})
    );
    await userEvent.click(await screen.findByRole('button', {name: 'Retry'}));

    expect(usageRequest).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByText('Usage details are not available for this receipt.')
    ).not.toBeInTheDocument();
  });

  it('does not render usage CSV downloads without the feature flag', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    const csv = 'https://sentry.io/organizations/dogz-rule/billing/contracts/1/export/';
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [
        InvoiceFixture({
          isClosed: true,
          isPaid: true,
          usageCsvLinks: {csv, csvPerProject: `${csv}per-project/`},
        }),
      ],
    });

    render(<PaymentHistory />, {organization});

    expect(await screen.findByText('Paid')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Download Usage CSV'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Usage for the Jun 25, 2018 receipt'})
    ).not.toBeInTheDocument();
  });

  it('does not render usage CSV downloads for other receipts', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
      features: ['invoice-usage-downloads'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [InvoiceFixture({isClosed: true, isPaid: true})],
    });

    render(<PaymentHistory />, {organization});

    expect(await screen.findByText('Paid')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Download Usage CSV'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Usage for the Jun 25, 2018 receipt'})
    ).not.toBeInTheDocument();
  });
});
