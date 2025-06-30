import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SeerReservedBudgetFixture} from 'getsentry-test/fixtures/reservedBudget';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';

describe('ProductSelect', function () {
  const api = new MockApiClient();
  const organization = OrganizationFixture({});
  const subscription = SubscriptionFixture({organization});
  const params = {};

  beforeEach(function () {
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
  });

  it('renders', async function () {
    const freeSubscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      isFree: true,
    });
    SubscriptionStore.set(organization.slug, freeSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    expect(await screen.findByTestId('body-choose-your-plan')).toBeInTheDocument();
    expect(screen.getByTestId('product-option-seer')).toBeInTheDocument();
    expect(screen.getAllByTestId(/product-option-feature/)).toHaveLength(2);
    expect(screen.getAllByTestId(/product-option/)).toHaveLength(3);
    expect(screen.getByText('Add to plan')).toBeInTheDocument();
    expect(screen.getByTestId('footer-choose-your-plan')).toBeInTheDocument();
  });

  it('does not render products if flags are missing', async function () {
    const mockBillingConfig = structuredClone(BillingConfigFixture(PlanTier.AM3));
    mockBillingConfig.planList.forEach(plan => {
      plan.features = plan.features.filter(feature => feature !== 'seer-billing');
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: mockBillingConfig,
    });

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    expect(await screen.findByTestId('body-choose-your-plan')).toBeInTheDocument();
    expect(screen.queryAllByTestId(/product-option/)).toHaveLength(0);
  });

  it('renders with correct monthly price and credits for products', async function () {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    expect(await screen.findByTestId('product-option-seer')).toHaveTextContent('$20/mo');
    expect(
      screen.getByText(
        'Detect and fix issues faster with $25/mo in credits towards our AI agent'
      )
    ).toBeInTheDocument();
  });

  it('renders with correct annual price and monthly credits for products', async function () {
    const annualSubscription = SubscriptionFixture({
      organization,
      plan: 'am3_team_auf',
    });
    SubscriptionStore.set(organization.slug, annualSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    expect(await screen.findByTestId('product-option-seer')).toHaveTextContent('$216/yr');
    expect(
      screen.getByText(
        'Detect and fix issues faster with $25/mo in credits towards our AI agent'
      )
    ).toBeInTheDocument();
  });

  it('renders with product selected based on current subscription', async function () {
    subscription.reservedBudgets = [SeerReservedBudgetFixture({id: '2'})];
    SubscriptionStore.set(organization.slug, subscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    expect(await screen.findByTestId('product-option-seer')).toHaveTextContent(
      'Added to plan'
    );
  });

  it('does not render with product selected based on current subscription if plan is trial', async function () {
    const trialSubscription = SubscriptionFixture({organization, plan: 'am3_t'});
    trialSubscription.reservedBudgets = [SeerReservedBudgetFixture({id: '2'})];
    SubscriptionStore.set(organization.slug, trialSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    expect(await screen.findByTestId('product-option-seer')).toHaveTextContent(
      'Add to plan'
    );
  });

  it('can enable and disable products', async function () {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization}
    );

    const seerProduct = await screen.findByTestId('product-option-seer');
    const seerButton = within(seerProduct).getByRole('button');
    expect(seerButton).toHaveTextContent('Add to plan');
    await userEvent.click(seerButton);
    expect(seerButton).toHaveTextContent('Added to plan');
  });
});
