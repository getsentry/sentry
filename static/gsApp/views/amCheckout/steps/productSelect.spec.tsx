import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SeerReservedBudgetFixture} from 'getsentry-test/fixtures/reservedBudget';
import {
  SubscriptionFixture,
  SubscriptionWithLegacySeerFixture,
} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {AddOnCategory, PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';

// XXX(isabella): This tests with both legacy Seer and Seer
// which wouldn't happen in production but is useful for testing
describe('ProductSelect', () => {
  const api = new MockApiClient();
  const organization = OrganizationFixture({features: ['seer-billing']});
  const subscription = SubscriptionFixture({organization});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    subscription.reservedBudgets = [];
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
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
      body: {
        invoiceItems: [],
      },
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
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
  });

  it('renders', async () => {
    const freeSubscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      isFree: true,
    });
    SubscriptionStore.set(organization.slug, freeSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    expect(await screen.findByTestId('product-option-legacySeer')).toBeInTheDocument();
    expect(screen.getAllByTestId(/product-option-feature/)).toHaveLength(3); // each subcategory + included credits
    expect(screen.getByTestId('product-option-seer')).toBeInTheDocument();
    expect(screen.getByTestId('product-option-description')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', {name: /Add Seer to plan/})).toHaveLength(4); // role is on entire box + checkbox within box; both options are named Seer
  });

  it('does not render products if unavailable', async () => {
    const unavailableSubscription = SubscriptionFixture({
      organization,
    });
    unavailableSubscription.addOns = {
      ...unavailableSubscription.addOns,
      [AddOnCategory.SEER]: {
        ...unavailableSubscription.addOns?.[AddOnCategory.SEER]!,
        isAvailable: false,
      },
    };
    SubscriptionStore.set(organization.slug, unavailableSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    expect(await screen.findByTestId('product-option-legacySeer')).toBeInTheDocument();
    expect(screen.queryByTestId('product-option-seer')).not.toBeInTheDocument();
  });

  it('renders with correct monthly price and credits for products', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    const seerProduct = await screen.findByTestId('product-option-legacySeer');
    expect(seerProduct).toHaveTextContent('$20/mo');
    expect(seerProduct).toHaveTextContent('Includes $25/mo in credits');
  });

  it('renders with correct annual price and monthly credits for products', async () => {
    const annualSubscription = SubscriptionFixture({
      organization,
      plan: 'am3_team_auf',
    });
    SubscriptionStore.set(organization.slug, annualSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    const seerProduct = await screen.findByTestId('product-option-legacySeer');
    expect(seerProduct).toHaveTextContent('$216/yr');
    expect(seerProduct).toHaveTextContent('Includes $25/mo in credits');
  });

  it('renders with product selected based on current subscription', async () => {
    const seerSubscription = SubscriptionWithLegacySeerFixture({organization});
    SubscriptionStore.set(organization.slug, seerSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    const legacySeerCheckbox = await screen.findByTestId('product-option-legacySeer');
    expect(legacySeerCheckbox).toBeChecked();
  });

  it('does not render with product selected based on current subscription if plan is trial', async () => {
    const trialSubscription = SubscriptionFixture({organization, plan: 'am3_t'});
    trialSubscription.reservedBudgets = [SeerReservedBudgetFixture({id: '2'})];
    SubscriptionStore.set(organization.slug, trialSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    const legacySeerCheckbox = await screen.findByTestId('product-option-legacySeer');
    expect(legacySeerCheckbox).not.toBeChecked();
  });
});
