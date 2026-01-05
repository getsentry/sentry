import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {BillingDetailsFixture} from 'getsentry-test/fixtures/billingDetails';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';

describe('AddBillingInformation', () => {
  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization, plan: 'am3_f'});

  beforeEach(() => {
    organization.access = ['org:billing'];
    api.clear();
    MockApiClient.clearMockResponses();
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
    });
    MockApiClient.addMockResponse({
      method: 'POST',
      url: '/_experiment/log_exposure/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
      body: {
        invoiceItems: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/setup/`,
      method: 'POST',
      body: {
        id: '123',
        clientSecret: 'seti_abc123',
        status: 'require_payment_method',
        lastError: null,
      },
    });
  });

  it('renders heading with complete existing billing info', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture(),
    });
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        api={api}
        checkoutTier={PlanTier.AM3}
        navigate={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByText('Edit billing information')).toBeInTheDocument();
    expect(screen.getByText('Business address')).toBeInTheDocument();
    expect(screen.getByText('Payment method')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm'})).toBeEnabled();
    expect(
      screen.getByRole('button', {name: 'Edit business address'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Edit payment method'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Save Changes'})).not.toBeInTheDocument();
  });

  it('renders heading with partial billing info', async () => {
    // subscription has payment source
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        api={api}
        checkoutTier={PlanTier.AM3}
        navigate={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByText('Edit billing information')).toBeInTheDocument();
    expect(screen.getByText('Business address')).toBeInTheDocument();
    expect(screen.getByText('Payment method')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm'})).toBeDisabled();
    expect(
      screen.queryByRole('button', {name: 'Edit business address'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Edit payment method'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save Changes'})).toBeInTheDocument();
  });

  it('renders heading and auto opens with no existing billing info', async () => {
    const newSubscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      paymentSource: null,
    });
    SubscriptionStore.set(organization.slug, newSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        api={api}
        checkoutTier={PlanTier.AM3}
        navigate={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByText('Add billing information')).toBeInTheDocument();
    expect(screen.getByText('Business address')).toBeInTheDocument();
    expect(screen.getByText('Payment method')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm'})).toBeDisabled();
    expect(
      screen.queryByRole('button', {name: 'Edit business address'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Edit payment method'})
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Save Changes'})).toHaveLength(2);
  });
});
