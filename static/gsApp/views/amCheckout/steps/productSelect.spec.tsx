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
    organization.features = ['seer-billing'];
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
    expect(screen.getAllByTestId(/product-option/)).toHaveLength(1);
    expect(screen.getByText('Add for $20/mo')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Includes $25/mo of credits for Seer services. Additional usage is drawn from your PAYG budget.'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('footer-choose-your-plan')).toBeInTheDocument();
  });

  it('does not render products if flags are missing', async function () {
    organization.features = [];
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
        'Includes $25/mo of credits for Seer services. Additional usage is drawn from your PAYG budget.'
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
        'Includes $25/mo of credits for Seer services. Additional usage is drawn from your PAYG budget.'
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

    subscription.reservedBudgets = []; // clear
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
    expect(seerButton).toHaveTextContent('$20/mo');
    await userEvent.click(seerButton);
    expect(seerButton).toHaveTextContent('Added to plan');
  });
});
