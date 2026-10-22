import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {PlanTier} from 'getsentry-test/planTier';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
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
    ).toEqual(['Date', 'Amount', 'Status', 'Receipt ID', '']);
    expect(
      within(row)
        .getAllByRole('cell')
        .map(cell => cell.textContent)
    ).toEqual(['Jun 25, 2018', '$120$20 refunded', 'Refunded', '1a2c3b4d5e6f', '']);
    expect(within(row).getByRole('link', {name: 'Jun 25, 2018'})).toHaveAttribute(
      'href',
      '/settings/dogz-rule/billing/receipts/1a2c3b4d5e6f/'
    );
    expect(within(row).getByRole('button', {name: 'Download PDF'})).toHaveAttribute(
      'href',
      'https://example.com/receipt.pdf'
    );
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
});
