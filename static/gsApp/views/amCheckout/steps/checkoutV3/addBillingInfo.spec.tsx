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
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
        isNewCheckout
        navigate={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByText('Edit billing information')).toBeInTheDocument();
    expect(screen.getByText('Business address')).toBeInTheDocument();
    expect(screen.getByText('Payment method')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm and pay'})).toBeEnabled();
  });

  it('renders heading with some existing billing info', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
        isNewCheckout
        navigate={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByText('Edit billing information')).toBeInTheDocument();
    expect(screen.getByText('Business address')).toBeInTheDocument();
    expect(screen.getByText('Payment method')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm and pay'})).toBeDisabled();
  });

  it('renders heading with no existing billing info', async () => {
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
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
        isNewCheckout
        navigate={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByText('Add billing information')).toBeInTheDocument();
    expect(screen.getByText('Business address')).toBeInTheDocument();
    expect(screen.getByText('Payment method')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm and pay'})).toBeDisabled();
  });
});
