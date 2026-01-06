import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import PaymentHistory from 'getsentry/views/subscriptionPage/paymentHistory';

describe('Subscription > PaymentHistory', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/dogz-rule/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM1),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/dogz-rule/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/dogz-rule/plan-migrations/`,
      query: {scheduled: 1, applied: 0},
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/customers/dogz-rule/recurring-credits/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/dogz-rule/prompts-activity/`,
      body: {},
    });
  });

  it('renders', async () => {
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
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [basicInvoice],
    });

    render(<PaymentHistory />, {organization});

    expect(await screen.findByTestId('payment-list')).toBeInTheDocument();
    expect(screen.getByText('Sep 20, 2021')).toBeInTheDocument();
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

    await screen.findByTestId('payment-list');
    expect(screen.getByText('No receipts found')).toBeInTheDocument();
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
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [],
    });

    render(<PaymentHistory />, {organization});
    expect(await screen.findByTestId('permission-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('payment-list')).not.toBeInTheDocument();
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

    expect(await screen.findByTestId('payment-list')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
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

    expect(await screen.findByTestId('payment-list')).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
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

    expect(await screen.findByTestId('payment-list')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('renders for new billing UI', async () => {
    const organization = OrganizationFixture({
      slug: 'dogz-rule',
      access: ['org:billing'],
      features: ['subscriptions-v3'],
    });
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/invoices/`,
      method: 'GET',
      body: [InvoiceFixture({isClosed: true, isPaid: true})],
    });
    render(<PaymentHistory />, {organization});

    await screen.findByText('Receipts');
    expect(screen.getByTestId('payment-list')).toBeInTheDocument();
  });
});
