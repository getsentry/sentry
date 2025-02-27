import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription as SubscriptionType} from 'getsentry/types';
import {OnDemandBudgetMode, PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout';
import {getCheckoutAPIData} from 'getsentry/views/amCheckout/utils';
import {hasOnDemandBudgetsFeature} from 'getsentry/views/onDemandBudgets/utils';

describe('AM1 Checkout', function () {
  let mockResponse: any;
  const api = new MockApiClient();
  const organization = OrganizationFixture({features: []});
  const subscription = SubscriptionFixture({organization});
  const params = {};

  beforeEach(function () {
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    mockResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM2),
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
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        checkoutTier={PlanTier.AM1}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(screen.getByTestId('checkout-steps')).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Business'})).toBeInTheDocument();

    await waitFor(() => {
      expect(mockResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am1'},
        })
      );
    });
  });

  it('can skip to step and continue', async function () {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        onToggleLegacy={jest.fn()}
        params={params}
        api={api}
        checkoutTier={PlanTier.AM1}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByText('Reserved Volumes'));
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    // Both steps are complete
    expect(
      within(screen.getByTestId('header-choose-your-plan')).getByTestId('icon-check-mark')
    ).toBeInTheDocument();

    expect(
      within(screen.getByTestId('header-reserved-volumes')).getByTestId('icon-check-mark')
    ).toBeInTheDocument();
  });

  it('renders cancel subscription button', async function () {
    const sub: SubscriptionType = {...subscription, canCancel: true};
    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={sub.planTier as PlanTier}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Cancel Subscription'})).toBeInTheDocument();
  });

  it('does not renders cancel subscription button if cannot cancel', async function () {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={subscription.planTier as PlanTier}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {name: 'Cancel Subscription'})
    ).not.toBeInTheDocument();
  });

  it('renders annual terms for annual plan', async function () {
    const sub: SubscriptionType = {
      ...subscription,
      plan: 'am1_team_auf',
      contractInterval: 'annual',
      billingInterval: 'annual',
    };

    SubscriptionStore.set(organization.slug, sub);

    const {container} = render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={sub.planTier as PlanTier}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(container).toHaveTextContent(
      'Annual subscriptions require a one-year non-cancellable commitment'
    );
  });

  it('does not render annual terms for monthly plan', async function () {
    const sub = {...subscription};
    SubscriptionStore.set(organization.slug, sub);

    const {container} = render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={sub.planTier as PlanTier}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(container).not.toHaveTextContent(
      'Annual subscriptions require a one-year non-cancellable commitment'
    );
  });

  it('renders default plan data', async function () {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={subscription.planTier as PlanTier}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(screen.getByRole('radio', {name: 'Business'})).toBeChecked();

    await userEvent.click(screen.getByText('Reserved Volumes'));

    // TODO: Can better write this once we have
    // https://github.com/testing-library/jest-dom/issues/478
    expect(screen.getByRole('slider', {name: 'Errors'})).toHaveAttribute(
      'aria-valuetext',
      '50000'
    );
    expect(screen.getByRole('slider', {name: 'Performance units'})).toHaveAttribute(
      'aria-valuetext',
      '100000'
    );
    expect(screen.getByRole('slider', {name: 'Replays'})).toHaveAttribute(
      'aria-valuetext',
      '500'
    );
    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '1'
    );

    await userEvent.click(screen.getByText('On-Demand Max Spend'));
    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toHaveValue('');
  });

  it('prefills with am1 team subscription data', async function () {
    const sub: SubscriptionType = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      categories: {
        errors: MetricHistoryFixture({reserved: 200000}),
        transactions: MetricHistoryFixture({reserved: 250000}),
        replays: MetricHistoryFixture({reserved: 10_000}),
        attachments: MetricHistoryFixture({reserved: 25}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
      },
      onDemandMaxSpend: 10000,
    });

    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {
        organization,
      }
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(screen.getByRole('radio', {name: 'Business'})).toBeChecked();

    await userEvent.click(screen.getByText('Reserved Volumes'));

    // TODO: Can better write this once we have
    // https://github.com/testing-library/jest-dom/issues/478
    expect(screen.getByRole('slider', {name: 'Errors'})).toHaveAttribute(
      'aria-valuetext',
      '200000'
    );
    expect(screen.getByRole('slider', {name: 'Performance units'})).toHaveAttribute(
      'aria-valuetext',
      '250000'
    );
    expect(screen.getByRole('slider', {name: 'Replays'})).toHaveAttribute(
      'aria-valuetext',
      '10000'
    );
    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '25'
    );

    await userEvent.click(screen.getByText('On-Demand Max Spend'));
    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toHaveValue('100');
  });

  it('prefills with am1 business subscription data', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      categories: {
        errors: MetricHistoryFixture({reserved: 50000}),
        transactions: MetricHistoryFixture({reserved: 250000}),
        replays: MetricHistoryFixture({reserved: 500}),
        attachments: MetricHistoryFixture({reserved: 50}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
      },
      onDemandMaxSpend: 10000,
    });

    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {
        organization,
      }
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(screen.getByRole('radio', {name: 'Business'})).toBeChecked();

    await userEvent.click(screen.getByText('Reserved Volumes'));

    // TODO: Can better write this once we have
    // https://github.com/testing-library/jest-dom/issues/478
    expect(screen.getByRole('slider', {name: 'Errors'})).toHaveAttribute(
      'aria-valuetext',
      '50000'
    );
    expect(screen.getByRole('slider', {name: 'Performance units'})).toHaveAttribute(
      'aria-valuetext',
      '250000'
    );
    expect(screen.getByRole('slider', {name: 'Replays'})).toHaveAttribute(
      'aria-valuetext',
      '500'
    );
    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '50'
    );

    await userEvent.click(screen.getByText('On-Demand Max Spend'));
    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toHaveValue('100');
  });

  it('prefills with mm2 team subscription data', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_b_100k',
      planTier: 'mm2',
      categories: {errors: MetricHistoryFixture({reserved: 100000})},
      onDemandMaxSpend: 2000,
    });

    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={sub.planTier as PlanTier}
      />,
      {
        organization,
      }
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(screen.getByRole('radio', {name: 'Business'})).toBeChecked();

    await userEvent.click(screen.getByText('Reserved Volumes'));

    // TODO: Can better write this once we have
    // https://github.com/testing-library/jest-dom/issues/478
    expect(screen.getByRole('slider', {name: 'Errors'})).toHaveAttribute(
      'aria-valuetext',
      '100000'
    );
    expect(screen.getByRole('slider', {name: 'Performance units'})).toHaveAttribute(
      'aria-valuetext',
      '100000'
    );
    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '1'
    );

    await userEvent.click(screen.getByText('On-Demand Max Spend'));
    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toHaveValue('20');
  });

  it('prefills with mm2 biz subscription data', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_a_100k',
      planTier: 'mm2',
      categories: {errors: MetricHistoryFixture({reserved: 100_000})},
      onDemandMaxSpend: 2000,
    });

    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(screen.getByRole('radio', {name: 'Business'})).toBeChecked();

    await userEvent.click(screen.getByText('Reserved Volumes'));

    // TODO: Can better write this once we have
    // https://github.com/testing-library/jest-dom/issues/478
    expect(screen.getByRole('slider', {name: 'Errors'})).toHaveAttribute(
      'aria-valuetext',
      '100000'
    );
    expect(screen.getByRole('slider', {name: 'Performance units'})).toHaveAttribute(
      'aria-valuetext',
      '100000'
    );
    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '1'
    );

    await userEvent.click(screen.getByText('On-Demand Max Spend'));
    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toHaveValue('20');
  });

  it('prefills with s1 subscription data', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 's1',
      planTier: 'mm1',
      categories: {errors: MetricHistoryFixture({reserved: 100000})},
      onDemandMaxSpend: 2000,
    });

    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={sub.planTier as PlanTier}
      />,
      {
        organization,
      }
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(screen.getByRole('radio', {name: 'Business'})).toBeChecked();

    await userEvent.click(screen.getByText('Reserved Volumes'));

    // TODO: Can better write this once we have
    // https://github.com/testing-library/jest-dom/issues/478
    expect(screen.getByRole('slider', {name: 'Errors'})).toHaveAttribute(
      'aria-valuetext',
      '100000'
    );
    expect(screen.getByRole('slider', {name: 'Performance units'})).toHaveAttribute(
      'aria-valuetext',
      '100000'
    );
    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '1'
    );

    await userEvent.click(screen.getByText('On-Demand Max Spend'));
    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toHaveValue('20');
  });

  it('prefills with l1 subscription data', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'l1',
      planTier: 'mm1',
      categories: {errors: MetricHistoryFixture({reserved: 100000})},
      onDemandMaxSpend: 2000,
    });

    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={sub.planTier as PlanTier}
      />,
      {
        organization,
      }
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(screen.getByRole('radio', {name: 'Business'})).toBeChecked();

    await userEvent.click(screen.getByText('Reserved Volumes'));

    // TODO: Can better write this once we have
    // https://github.com/testing-library/jest-dom/issues/478
    expect(screen.getByRole('slider', {name: 'Errors'})).toHaveAttribute(
      'aria-valuetext',
      '100000'
    );
    expect(screen.getByRole('slider', {name: 'Performance units'})).toHaveAttribute(
      'aria-valuetext',
      '100000'
    );
    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '1'
    );

    await userEvent.click(screen.getByText('On-Demand Max Spend'));
    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toHaveValue('20');
  });

  it('handles subscription with unlimited ondemand', async function () {
    const sub = {...subscription, onDemandMaxSpend: -1};
    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {
        organization,
      }
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByText('On-Demand Max Spend'));
    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toHaveValue('');
  });
});

describe('AM2 Checkout', function () {
  let mockResponse: any;

  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});
  const params = {};

  beforeEach(function () {
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });

    mockResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM2),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: {},
    });
  });

  it('renders for am1 team plan', async function () {
    const sub = SubscriptionFixture({organization, plan: 'am1_team'});
    SubscriptionStore.set(organization.slug, sub);

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

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Business'})).toBeInTheDocument();
    expect(screen.getByText('Cross-project visibility')).toBeInTheDocument();

    expect(screen.getByRole('radio', {name: 'Team'})).toBeInTheDocument();
    expect(screen.getByText('Unlimited members')).toBeInTheDocument();

    expect(mockResponse).toHaveBeenCalledWith(
      `/customers/${organization.slug}/billing-config/`,
      expect.objectContaining({
        method: 'GET',
        data: {tier: PlanTier.AM2},
      })
    );
  });

  it('renders for am2 free plan', async function () {
    const sub = SubscriptionFixture({organization, plan: 'am2_f'});
    SubscriptionStore.set(organization.slug, sub);

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

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Business'})).toBeInTheDocument();
    expect(screen.getByText('Cross-project visibility')).toBeInTheDocument();

    expect(screen.getByRole('radio', {name: 'Team'})).toBeInTheDocument();
    expect(screen.getByText('Unlimited members')).toBeInTheDocument();

    expect(mockResponse).toHaveBeenCalledWith(
      `/customers/${organization.slug}/billing-config/`,
      expect.objectContaining({
        method: 'GET',
        data: {tier: PlanTier.AM2},
      })
    );
  });

  it('prefills subscription data based on price with same plan type', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: 'am1',
      categories: {
        errors: MetricHistoryFixture({reserved: 50_000}),
        transactions: MetricHistoryFixture({reserved: 20_000_000}),
        replays: MetricHistoryFixture({reserved: 500}),
        attachments: MetricHistoryFixture({reserved: 1}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
      },
      onDemandMaxSpend: 2000,
    });

    SubscriptionStore.set(organization.slug, sub);

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

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(screen.getByRole('radio', {name: 'Business'})).toBeChecked();

    await userEvent.click(screen.getByText('Reserved Volumes'));

    // TODO: Can better write this once we have
    // https://github.com/testing-library/jest-dom/issues/478
    expect(screen.getByRole('slider', {name: 'Errors'})).toHaveAttribute(
      'aria-valuetext',
      '50000'
    );
    expect(screen.getByRole('slider', {name: 'Performance units'})).toHaveAttribute(
      'aria-valuetext',
      '35000000'
    );
    expect(screen.getByRole('slider', {name: 'Replays'})).toHaveAttribute(
      'aria-valuetext',
      '500'
    );
    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '1'
    );

    await userEvent.click(screen.getByText('On-Demand Max Spend'));
    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toHaveValue('20');
  });

  it('prefills subscription data based on price with annual plan', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am1_business_auf',
      planTier: 'am1',
      categories: {
        errors: MetricHistoryFixture({reserved: 100_000}),
        transactions: MetricHistoryFixture({reserved: 20_000_000}),
        replays: MetricHistoryFixture({reserved: 500}),
        attachments: MetricHistoryFixture({reserved: 1}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
      },
      onDemandMaxSpend: 2000,
    });

    SubscriptionStore.set(organization.slug, sub);

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

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(screen.getByRole('radio', {name: 'Business'})).toBeChecked();

    await userEvent.click(screen.getByText('Reserved Volumes'));

    // TODO: Can better write this once we have
    // https://github.com/testing-library/jest-dom/issues/478
    expect(screen.getByRole('slider', {name: 'Errors'})).toHaveAttribute(
      'aria-valuetext',
      '100000'
    );
    expect(screen.getByRole('slider', {name: 'Performance units'})).toHaveAttribute(
      'aria-valuetext',
      '35000000'
    );
    expect(screen.getByRole('slider', {name: 'Replays'})).toHaveAttribute(
      'aria-valuetext',
      '500'
    );
    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '1'
    );

    await userEvent.click(screen.getByText('On-Demand Max Spend'));
    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toHaveValue('20');
  });

  it('prefills subscription data based on events with different plan type', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am1_team',
      planTier: 'am1',
      categories: {
        errors: MetricHistoryFixture({reserved: 100_000}),
        transactions: MetricHistoryFixture({reserved: 20_000_000}),
        attachments: MetricHistoryFixture({reserved: 1}),
        replays: MetricHistoryFixture({reserved: 500}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
      },
      onDemandMaxSpend: 2000,
    });

    SubscriptionStore.set(organization.slug, sub);

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

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(screen.getByRole('radio', {name: 'Business'})).toBeChecked();

    await userEvent.click(screen.getByText('Reserved Volumes'));

    // TODO: Can better write this once we have
    // https://github.com/testing-library/jest-dom/issues/478
    expect(screen.getByRole('slider', {name: 'Errors'})).toHaveAttribute(
      'aria-valuetext',
      '100000'
    );
    expect(screen.getByRole('slider', {name: 'Performance units'})).toHaveAttribute(
      'aria-valuetext',
      '20000000'
    );
    expect(screen.getByRole('slider', {name: 'Replays'})).toHaveAttribute(
      'aria-valuetext',
      '500'
    );
    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '1'
    );

    await userEvent.click(screen.getByText('On-Demand Max Spend'));
    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toHaveValue('20');
  });

  it('displays 40% india promotion', async function () {
    const promotionData = {
      completedPromotions: [
        {
          promotion: {
            name: 'Test Promotion',
            slug: 'test_promotion',
            timeLimit: null,
            startDate: null,
            endDate: null,
            showDiscountInfo: true,
            discountInfo: {
              amount: 4000,
              billingInterval: 'monthly',
              billingPeriods: 3,
              creditCategory: 'subscription',
              discountType: 'percentPoints',
              disclaimerText:
                "*Receive 40% off the monthly price of Sentry's Team or Business plan subscriptions for your first three months if you upgrade today",
              durationText: 'First three months',
            },
          },
        },
      ],
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
      body: promotionData,
    });

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

    await screen.findByText('Choose Your Plan');

    expect(
      screen.getByText(
        "*Receive 40% off the monthly price of Sentry's Team or Business plan subscriptions for your first three months if you upgrade today"
      )
    ).toBeInTheDocument();

    expect(screen.getByText('First three months 40% off')).toBeInTheDocument();
    expect(screen.getAllByText('53.40')).toHaveLength(2);
  });

  it('skips step 1 for business plan in same tier', async function () {
    const am2BizSubscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
      planTier: 'am2',
      categories: {
        errors: MetricHistoryFixture({reserved: 100_000}),
        transactions: MetricHistoryFixture({reserved: 20_000_000}),
        attachments: MetricHistoryFixture({reserved: 1}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
        profileDuration: MetricHistoryFixture({reserved: 1}),
        replays: MetricHistoryFixture({reserved: 10_000}),
      },
      onDemandMaxSpend: 2000,
    });

    SubscriptionStore.set(organization.slug, am2BizSubscription);

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
    await screen.findByText('Choose Your Plan');
    expect(screen.queryByTestId('body-choose-your-plan')).not.toBeInTheDocument();
    expect(screen.getByTestId('errors-volume-item')).toBeInTheDocument();
  });

  it('test business bundle standard checkout', async function () {
    const am2BizSubscription = SubscriptionFixture({
      organization,
      plan: 'am2_business_bundle',
      planTier: 'am2',
      categories: {
        errors: MetricHistoryFixture({reserved: 100_000}),
        transactions: MetricHistoryFixture({reserved: 20_000_000}),
        attachments: MetricHistoryFixture({reserved: 1}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
        profileDuration: MetricHistoryFixture({reserved: 1}),
        replays: MetricHistoryFixture({reserved: 10_000}),
      },
      onDemandMaxSpend: 2000,
    });
    SubscriptionStore.set(organization.slug, am2BizSubscription);

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

    // wait for page load
    await screen.findByText('Choose Your Plan');

    // "Choose Your Plan" should be skipped and "Reserved Volumes" should be visible
    // This is existing behavior to skip "Choose Your Plan" step for existing business customers
    expect(screen.queryByTestId('body-choose-your-plan')).not.toBeInTheDocument();
    expect(screen.getByTestId('errors-volume-item')).toBeInTheDocument();

    // Click on "Choose Your Plan" and verify that Business is selected
    await userEvent.click(screen.getByText('Choose Your Plan'));
    expect(screen.getByRole('radio', {name: 'Business'})).toBeChecked();
  });

  it('handles missing categories in subscription.categories', async function () {
    /**
     * In this test, we create a subscription where some categories are missing from
     * `subscription.categories`. We then verify that the component renders correctly
     * without throwing errors, and that the missing categories default to a reserved
     * value of 0.
     */
    const sub = SubscriptionFixture({
      organization,
      plan: 'am2_business',
      planTier: 'am2',
      categories: {
        // Intentionally omitting 'transactions' and 'replays' categories
        errors: MetricHistoryFixture({reserved: 100_000}),
        attachments: MetricHistoryFixture({reserved: 1}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
      },
      onDemandMaxSpend: 2000,
    });

    SubscriptionStore.set(organization.slug, sub);

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

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    // Verify that the component renders without errors
    expect(screen.getByTestId('errors-volume-item')).toBeInTheDocument();

    // Open 'Reserved Volumes' section
    await userEvent.click(screen.getByText('Reserved Volumes'));

    // Check that missing categories default to 0
    expect(screen.getByRole('slider', {name: 'Errors'})).toHaveAttribute(
      'aria-valuetext',
      '100000'
    );
    // For missing 'Performance units', should default to 100,000 units
    expect(screen.getByRole('slider', {name: 'Performance units'})).toHaveAttribute(
      'aria-valuetext',
      '100000'
    );
    // For missing 'Replays', should default to 500
    expect(screen.getByRole('slider', {name: 'Replays'})).toHaveAttribute(
      'aria-valuetext',
      '500'
    );

    // Check that 'Attachments' category is correctly set
    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '1'
    );

    // Open 'On-Demand Max Spend' section
    await userEvent.click(screen.getByText('On-Demand Max Spend'));
    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toHaveValue('20');
  });
});

describe('AM3 Checkout', function () {
  const api = new MockApiClient();
  const organization = OrganizationFixture({
    features: ['ondemand-budgets', 'am3-billing'],
  });
  const params = {};

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: {},
    });
  });

  it('renders for new customers (AM3 free plan)', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: PlanTier.AM3,
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    const mockResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
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

    expect(await screen.findByText('Set Your Pay-as-you-go Budget')).toBeInTheDocument();

    expect(mockResponse).toHaveBeenCalledWith(
      `/customers/${organization.slug}/billing-config/`,
      expect.objectContaining({
        method: 'GET',
        data: {tier: PlanTier.AM3},
      })
    );
  });

  it('renders for customers migrating from partner billing', async function () {
    organization.features.push('partner-billing-migration');
    const contractPeriodEnd = moment();
    const sub = SubscriptionFixture({
      organization,
      contractPeriodEnd: contractPeriodEnd.toString(),
      plan: 'am2_sponsored_team_auf',
      planTier: PlanTier.AM2,
      isSponsored: true,
      partner: {
        isActive: true,
        externalId: 'yuh',
        partnership: {
          id: 'FOO',
          displayName: 'FOO',
          supportNote: '',
        },
        name: '',
      },
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    const mockResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
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

    expect(await screen.findByText('Set Your Pay-as-you-go Budget')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your promotional plan with FOO ends on ' + contractPeriodEnd.format('ll') + '.'
      )
    ).toBeInTheDocument();

    // 500 replays from sponsored plan becomes 50 on am3
    expect(screen.getByText('50')).toBeInTheDocument();

    expect(mockResponse).toHaveBeenCalledWith(
      `/customers/${organization.slug}/billing-config/`,
      expect.objectContaining({
        method: 'GET',
        data: {tier: PlanTier.AM3},
      })
    );
  });

  it('renders for self-serve partners', async function () {
    const contractPeriodEnd = moment();
    const sub = SubscriptionFixture({
      organization,
      contractPeriodEnd: contractPeriodEnd.toString(),
      plan: 'am3_f',
      planTier: PlanTier.AM3,
      isSelfServePartner: true,
      partner: {
        isActive: true,
        externalId: 'foo',
        partnership: {
          id: 'XX',
          displayName: 'BAR',
          supportNote: '',
        },
        name: '',
      },
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    const mockResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
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

    expect(await screen.findByText('Set Your Pay-as-you-go Budget')).toBeInTheDocument();
    expect(await screen.findByText('Contract Term & Discounts')).toBeInTheDocument();
    expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
    expect(screen.queryByText('Payment Method')).not.toBeInTheDocument();
    expect(screen.queryByText('Billing Details')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'Your promotional plan with BAR ends on ' + contractPeriodEnd.format('ll') + '.'
      )
    ).not.toBeInTheDocument();

    expect(mockResponse).toHaveBeenCalledWith(
      `/customers/${organization.slug}/billing-config/`,
      expect.objectContaining({
        method: 'GET',
        data: {tier: PlanTier.AM3},
      })
    );
  });

  it('renders for VC partners', async function () {
    organization.features.push('vc-marketplace-active-customer');
    const contractPeriodEnd = moment();
    const sub = SubscriptionFixture({
      organization,
      contractPeriodEnd: contractPeriodEnd.toString(),
      plan: 'am3_f',
      planTier: PlanTier.AM3,
      isSelfServePartner: true,
      partner: {
        isActive: true,
        externalId: 'foo',
        partnership: {
          id: 'XX',
          displayName: 'XX',
          supportNote: '',
        },
        name: '',
      },
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    const mockResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
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

    expect(await screen.findByText('Set Your Pay-as-you-go Budget')).toBeInTheDocument();
    expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
    expect(screen.queryByText('Payment Method')).not.toBeInTheDocument();
    expect(screen.queryByText('Billing Details')).not.toBeInTheDocument();
    expect(screen.queryByText('Contract Term & Discounts')).not.toBeInTheDocument();

    expect(mockResponse).toHaveBeenCalledWith(
      `/customers/${organization.slug}/billing-config/`,
      expect.objectContaining({
        method: 'GET',
        data: {tier: PlanTier.AM3},
      })
    );
  });

  it('does not render for AM2 customers', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am2_f',
      planTier: PlanTier.AM2,
    });
    act(() => SubscriptionStore.set(organization.slug, sub));

    const mockResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM2),
    });

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

    expect(await screen.findByText('Choose Your Plan')).toBeInTheDocument();
    expect(screen.queryByText('Set Your Pay-as-you-go Budget')).not.toBeInTheDocument();

    expect(mockResponse).toHaveBeenCalledWith(
      `/customers/${organization.slug}/billing-config/`,
      expect.objectContaining({
        method: 'GET',
        data: {tier: PlanTier.AM2},
      })
    );
  });

  it('does not render for AM1 customers', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      planTier: PlanTier.AM1,
    });
    act(() => SubscriptionStore.set(organization.slug, sub));

    const mockResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM1),
    });

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM1}
      />,
      {organization}
    );

    expect(await screen.findByText('Choose Your Plan')).toBeInTheDocument();
    expect(screen.queryByText('Set Your Pay-as-you-go Budget')).not.toBeInTheDocument();

    expect(mockResponse).toHaveBeenCalledWith(
      `/customers/${organization.slug}/billing-config/`,
      expect.objectContaining({
        method: 'GET',
        data: {tier: PlanTier.AM1},
      })
    );
  });

  it('prefills with existing subscription data', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
    });

    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_business',
      planTier: PlanTier.AM3,
      categories: {
        errors: MetricHistoryFixture({reserved: 100_000}),
        attachments: MetricHistoryFixture({reserved: 25}),
        replays: MetricHistoryFixture({reserved: 50}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
        spans: MetricHistoryFixture({reserved: 20_000_000}),
        profileDuration: MetricHistoryFixture({reserved: 1}),
      },
      onDemandBudgets: {
        onDemandSpendUsed: 0,
        sharedMaxBudget: 2000,
        budgetMode: OnDemandBudgetMode.SHARED,
        enabled: true,
      },
      onDemandMaxSpend: 2000,
      supportsOnDemand: true,
    });

    SubscriptionStore.set(organization.slug, sub);

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

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();
    expect(screen.getByTestId('errors-volume-item')).toBeInTheDocument(); // skips over first step when subscription is already on Business plan
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue('20');

    // TODO: Can better write this once we have
    // https://github.com/testing-library/jest-dom/issues/478
    expect(screen.getByRole('slider', {name: 'Errors'})).toHaveAttribute(
      'aria-valuetext',
      '100000'
    );
    expect(screen.getByRole('slider', {name: 'Replays'})).toHaveAttribute(
      'aria-valuetext',
      '50'
    );
    expect(screen.getByRole('slider', {name: 'Spans'})).toHaveAttribute(
      'aria-valuetext',
      '20000000'
    );
    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '25'
    );

    expect(
      screen.queryByRole('slider', {name: 'Accepted Spans'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('slider', {name: 'Stored Spans'})).not.toBeInTheDocument();
    expect(screen.queryByRole('slider', {name: 'Cron Monitors'})).not.toBeInTheDocument();
  });

  it('allows setting PAYG for customers switching to AM3', async function () {
    const sub = SubscriptionFixture({
      organization,
      // This plan does not have hasOnDemandModes
      plan: 'mm2_b_100k',
      planTier: PlanTier.AM2,
    });
    act(() => SubscriptionStore.set(organization.slug, sub));

    const mockResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
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

    expect(hasOnDemandBudgetsFeature(organization, sub)).toBe(false);
    expect(await screen.findByText('Choose Your Plan')).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Business'})).toBeChecked();
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    await userEvent.clear(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Pay-as-you-go budget'}),
      '20'
    );
    expect(await screen.findByTestId('additional-monthly-charge')).toHaveTextContent(
      '+ up to $20/mo based on PAYG usage'
    );

    expect(mockResponse).toHaveBeenCalledWith(
      `/customers/${organization.slug}/billing-config/`,
      expect.objectContaining({
        method: 'GET',
        data: {tier: PlanTier.AM3},
      })
    );
  });

  it('handles missing categories in subscription.categories', async function () {
    // Add billing config mock response
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
    });

    /**
     * In this test, we create a subscription where some categories are missing from
     * `subscription.categories`. We then verify that the component renders correctly
     * without throwing errors, and that the missing categories default to a reserved
     * value of 0.
     */
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_business',
      planTier: PlanTier.AM3,
      categories: {
        // Intentionally omitting 'errors' and 'attachments' categories
        replays: MetricHistoryFixture({reserved: 50}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
        spans: MetricHistoryFixture({reserved: 1}),
        profileDuration: MetricHistoryFixture({reserved: 1}),
      },
      onDemandBudgets: {
        onDemandSpendUsed: 0,
        sharedMaxBudget: 2000,
        budgetMode: OnDemandBudgetMode.SHARED,
        enabled: true,
      },
      supportsOnDemand: true,
    });

    SubscriptionStore.set(organization.slug, sub);

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

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    // Verify that the component renders without errors
    expect(screen.getByTestId('replays-volume-item')).toBeInTheDocument();

    // For AM3, we should see "Set Your Pay-as-you-go Budget" first
    expect(screen.getByText('Set Your Pay-as-you-go Budget')).toBeInTheDocument();

    // Check that missing 'Errors' category defaults to 50,000 errors
    expect(screen.getByRole('slider', {name: 'Errors'})).toHaveAttribute(
      'aria-valuetext',
      '50000'
    );
    // For 'Replays', should be set to 50 as per the subscription
    expect(screen.getByRole('slider', {name: 'Replays'})).toHaveAttribute(
      'aria-valuetext',
      '50'
    );
    // Check that missing 'Attachments' category defaults to 1 GB
    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '1'
    );

    // Verify that the 'Pay-as-you-go budget' is correctly set
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue('20');
  });

  it('handles zero platform reserve', function () {
    const formData = {
      plan: 'am3_business',
      reserved: {
        errors: 10000,
        transactions: 0,
        attachments: 0,
        replays: 0,
        monitorSeats: 0,
        profileDuration: 0,
        spans: 0,
      },
    };

    expect(getCheckoutAPIData({formData})).toEqual({
      onDemandBudget: undefined,
      onDemandMaxSpend: 0,
      plan: 'am3_business',
      referrer: 'billing',
      reservedErrors: 10000,
      reservedTransactions: 0,
      reservedAttachments: 0,
      reservedReplays: 0,
      reservedMonitorSeats: 0,
      reservedProfileDuration: 0,
      reservedSpans: 0,
    });
  });
});
