import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {
  SubscriptionFixture,
  SubscriptionWithSeerFixture,
} from 'getsentry-test/fixtures/subscription';
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

function assertCheckoutV3Steps(tier: PlanTier) {
  expect(screen.getByTestId('checkout-steps')).toBeInTheDocument();
  [
    'Build your plan',
    [PlanTier.AM1, PlanTier.AM2].includes(tier)
      ? /Set your on-demand limit/
      : /Set your pay-as-you-go limit/,
    'Pay monthly or yearly, your choice',
    'Edit billing information',
  ].forEach(step => {
    expect(screen.getByText(step)).toBeInTheDocument();
  });
}

describe('AM1 Checkout', () => {
  let mockResponse: any;
  const api = new MockApiClient();
  const organization = OrganizationFixture({features: []});
  const subscription = SubscriptionFixture({organization});

  beforeEach(() => {
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

  it('renders', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        checkoutTier={PlanTier.AM1}
        navigate={jest.fn()}
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

  it('renders for checkout v3', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
    });

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        checkoutTier={PlanTier.AM1}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        isNewCheckout
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am1'},
        })
      );
    });

    assertCheckoutV3Steps(PlanTier.AM1);
  });

  it('can skip to step and continue', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        onToggleLegacy={jest.fn()}
        navigate={jest.fn()}
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

  it('renders cancel subscription button', async () => {
    const sub: SubscriptionType = {...subscription, canCancel: true};
    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
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

  it('renders pending cancellation button', async () => {
    const sub: SubscriptionType = {
      ...subscription,
      canCancel: true,
      cancelAtPeriodEnd: true,
    };
    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={sub.planTier as PlanTier}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    expect(await screen.findByText('Pending Cancellation')).toBeInTheDocument();
  });

  it('does not renders cancel subscription button if cannot cancel', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
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

  it('renders annual terms for annual plan', async () => {
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
        navigate={jest.fn()}
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

  it('does not render annual terms for monthly plan', async () => {
    const sub = {...subscription};
    SubscriptionStore.set(organization.slug, sub);

    const {container} = render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
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

  it('renders default plan data', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
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

  it('prefills with am1 team subscription data', async () => {
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
        navigate={jest.fn()}
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

  it('prefills with am1 business subscription data', async () => {
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
        navigate={jest.fn()}
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

  it('prefills with mm2 team subscription data', async () => {
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
        navigate={jest.fn()}
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

  it('prefills with mm2 biz subscription data', async () => {
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
        navigate={jest.fn()}
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

  it('prefills with s1 subscription data', async () => {
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
        navigate={jest.fn()}
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

  it('prefills with l1 subscription data', async () => {
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
        navigate={jest.fn()}
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

  it('handles subscription with unlimited ondemand', async () => {
    const sub = {...subscription, onDemandMaxSpend: -1};
    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
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

describe('AM2 Checkout', () => {
  let mockResponse: any;

  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});

  beforeEach(() => {
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

  it('renders for checkout v3', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
    });

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        checkoutTier={PlanTier.AM2}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        isNewCheckout
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am2'},
        })
      );
    });

    assertCheckoutV3Steps(PlanTier.AM2);
  });

  it('renders for am1 team plan', async () => {
    const sub = SubscriptionFixture({organization, plan: 'am1_team'});
    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
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

  it('renders for am2 free plan', async () => {
    const sub = SubscriptionFixture({organization, plan: 'am2_f'});
    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
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

  it('prefills subscription data based on price with same plan type', async () => {
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
        navigate={jest.fn()}
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

  it('prefills subscription data based on price with annual plan', async () => {
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
        navigate={jest.fn()}
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

  it('prefills subscription data based on events with different plan type', async () => {
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
        navigate={jest.fn()}
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

  it('displays 40% india promotion', async () => {
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
        navigate={jest.fn()}
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

  it('skips step 1 for business plan in same tier', async () => {
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
        navigate={jest.fn()}
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

  it('does not skip step 1 for business plan pre-backfill', async () => {
    const launchOrg = OrganizationFixture({features: ['seer-billing']});
    const am2BizSubscription = SubscriptionFixture({
      organization: launchOrg,
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

    SubscriptionStore.set(launchOrg.slug, am2BizSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization: launchOrg}
    );
    await screen.findByText('Choose Your Plan');
    expect(screen.getByTestId('body-choose-your-plan')).toBeInTheDocument();
    expect(screen.queryByTestId('errors-volume-item')).not.toBeInTheDocument();
  });

  it('skips step 1 for business plan with seer', async () => {
    const seerOrg = OrganizationFixture({features: ['seer-billing']});
    const seerSubscription = SubscriptionWithSeerFixture({
      organization: seerOrg,
      planTier: 'am2',
      plan: 'am2_business',
    });

    SubscriptionStore.set(organization.slug, seerSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization: seerOrg}
    );
    await screen.findByText('Choose Your Plan');
    expect(screen.queryByTestId('body-choose-your-plan')).not.toBeInTheDocument();
    expect(screen.getByTestId('errors-volume-item')).toBeInTheDocument();
  });

  it('does not skip step 1 for business plan without seer', async () => {
    const nonSeerOrg = OrganizationFixture({features: ['seer-billing']});
    const nonSeerSubscription = SubscriptionFixture({
      organization: nonSeerOrg,
      planTier: 'am2',
      plan: 'am2_business',
    });

    SubscriptionStore.set(organization.slug, nonSeerSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization: nonSeerOrg}
    );
    await screen.findByText('Choose Your Plan');
    expect(screen.getByTestId('body-choose-your-plan')).toBeInTheDocument();
    expect(screen.queryByTestId('errors-volume-item')).not.toBeInTheDocument();
  });

  it('test business bundle standard checkout', async () => {
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
        navigate={jest.fn()}
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

  it('handles missing categories in subscription.categories', async () => {
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
        navigate={jest.fn()}
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

  it('does not use trial volumes for trial subscriptions in checkout', async () => {
    /**
     * Test for the trial checkout slider fix. When subscription.isTrial is true,
     * the checkout should use default volumes instead of trial reserved volumes.
     */
    const trialSub = SubscriptionFixture({
      organization,
      plan: 'am2_t',
      planTier: 'am2',
      isTrial: true, // This is true for both subscription trials and plan trials
      categories: {
        // These are high trial volumes that should NOT be used in checkout
        errors: MetricHistoryFixture({reserved: 500_000}), // High trial volume
        transactions: MetricHistoryFixture({reserved: 50_000_000}), // High trial volume
        replays: MetricHistoryFixture({reserved: 25_000}), // High trial volume
        attachments: MetricHistoryFixture({reserved: 100}), // High trial volume
        monitorSeats: MetricHistoryFixture({reserved: 10}),
        profileDuration: MetricHistoryFixture({reserved: 10}),
      },
      onDemandMaxSpend: 5000,
    });

    SubscriptionStore.set(organization.slug, trialSub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    // Navigate to Reserved Volumes step
    await userEvent.click(screen.getByText('Reserved Volumes'));

    // Verify that sliders show DEFAULT values, NOT the high trial volumes
    // The key test is that they are NOT the trial volumes we set above
    expect(screen.getByRole('slider', {name: 'Errors'})).not.toHaveAttribute(
      'aria-valuetext',
      '500000' // Should NOT be the trial value
    );
    expect(screen.getByRole('slider', {name: 'Performance units'})).not.toHaveAttribute(
      'aria-valuetext',
      '50000000' // Should NOT be the trial value
    );
    expect(screen.getByRole('slider', {name: 'Replays'})).not.toHaveAttribute(
      'aria-valuetext',
      '25000' // Should NOT be the trial value
    );
    expect(screen.getByRole('slider', {name: 'Attachments'})).not.toHaveAttribute(
      'aria-valuetext',
      '100' // Should NOT be the trial value
    );

    // Verify they are reasonable default values instead
    const errorsSlider = screen.getByRole('slider', {name: 'Errors'});
    const errorsValue = parseInt(errorsSlider.getAttribute('aria-valuetext') || '0', 10);
    expect(errorsValue).toBe(50_000); // Should be much less than trial volume
    expect(errorsValue).toBeGreaterThan(0); // Should be a reasonable default

    const replaysSlider = screen.getByRole('slider', {name: 'Replays'});
    const replaysValue = parseInt(
      replaysSlider.getAttribute('aria-valuetext') || '0',
      10
    );
    expect(replaysValue).toBe(500); // Should be much less than trial volume
    expect(replaysValue).toBeGreaterThan(0); // Should be a reasonable default
  });

  it('continues to use reserved volumes for non-trial subscriptions', async () => {
    /**
     * Regression test to ensure non-trial subscriptions still work as expected
     * and use their actual reserved volumes in checkout.
     */
    const nonTrialSub = SubscriptionFixture({
      organization,
      plan: 'am2_business',
      planTier: 'am2',
      isTrial: false, // NOT a trial subscription
      categories: {
        errors: MetricHistoryFixture({reserved: 200_000}),
        transactions: MetricHistoryFixture({reserved: 30_000_000}),
        replays: MetricHistoryFixture({reserved: 25_000}),
        attachments: MetricHistoryFixture({reserved: 50}),
        monitorSeats: MetricHistoryFixture({reserved: 5}),
        profileDuration: MetricHistoryFixture({reserved: 5}),
      },
      onDemandMaxSpend: 3000,
    });

    SubscriptionStore.set(organization.slug, nonTrialSub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    // Navigate to Reserved Volumes step
    await userEvent.click(screen.getByText('Reserved Volumes'));

    // Verify that sliders show the ACTUAL reserved volumes from subscription
    // These values might be adjusted by price comparison logic, but should be based on the reserved values
    expect(screen.getByRole('slider', {name: 'Errors'})).toHaveAttribute(
      'aria-valuetext',
      '200000' // Should use actual reserved volume
    );

    // Performance units might be adjusted by price comparison, but should be reasonable
    const performanceSlider = screen.getByRole('slider', {name: 'Performance units'});
    const performanceValue = parseInt(
      performanceSlider.getAttribute('aria-valuetext') || '0',
      10
    );
    expect(performanceValue).toBe(30_000_000);

    // Replays and attachments should be close to our reserved values
    const replaysSlider = screen.getByRole('slider', {name: 'Replays'});
    const replaysValue = parseInt(
      replaysSlider.getAttribute('aria-valuetext') || '0',
      10
    );
    expect(replaysValue).toBe(25_000);

    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '50' // Should use actual reserved volume
    );

    // Verify onDemand also uses actual value
    await userEvent.click(screen.getByText('On-Demand Max Spend'));
    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toHaveValue('30');
  });
});

describe('AM3 Checkout', () => {
  const api = new MockApiClient();
  const organization = OrganizationFixture({
    features: ['ondemand-budgets', 'am3-billing'],
  });

  beforeEach(() => {
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

  it('renders for checkout v3', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
    });
    const mockResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
    });

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        checkoutTier={PlanTier.AM3}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        isNewCheckout
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am3'},
        })
      );
    });

    assertCheckoutV3Steps(PlanTier.AM3);
  });

  it('renders for new customers (AM3 free plan)', async () => {
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
        navigate={jest.fn()}
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

  it('renders for customers migrating from partner billing', async () => {
    organization.features.push('partner-billing-migration');
    const contractPeriodEnd = moment();
    const sub = SubscriptionFixture({
      organization,
      contractPeriodEnd: contractPeriodEnd.toISOString(),
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
        navigate={jest.fn()}
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
    organization.features.pop(); // clean up
  });

  it('renders for self-serve partners', async () => {
    const contractPeriodEnd = moment();
    const sub = SubscriptionFixture({
      organization,
      contractPeriodEnd: contractPeriodEnd.toISOString(),
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
        navigate={jest.fn()}
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

  it('renders banner for self-serve partners', async () => {
    const contractPeriodEnd = moment();
    const sub = SubscriptionFixture({
      organization,
      contractPeriodEnd: contractPeriodEnd.toISOString(),
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
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
    });

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    expect(await screen.findByText('Set Your Pay-as-you-go Budget')).toBeInTheDocument();
    expect(
      screen.getByText('Billing handled externally through BAR')
    ).toBeInTheDocument();
  });

  it('renders for VC partners', async () => {
    organization.features.push('vc-marketplace-active-customer');
    const contractPeriodEnd = moment();
    const sub = SubscriptionFixture({
      organization,
      contractPeriodEnd: contractPeriodEnd.toISOString(),
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
        navigate={jest.fn()}
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

  it('does not render for AM2 customers', async () => {
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
        navigate={jest.fn()}
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

  it('does not render for AM1 customers', async () => {
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
        navigate={jest.fn()}
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

  it('prefills with existing subscription data', async () => {
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
      isFree: false,
    });

    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue('20');

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    expect(screen.getByTestId('errors-volume-item')).toBeInTheDocument(); // skips over first step when subscription is already on Business plan
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

  it('prefills with existing subscription data with plan trial', async () => {
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
      isFree: false,
      isTrial: true, // isTrial is true for both subscription trials and plan trials
    });

    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue('20');

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    expect(screen.getByTestId('errors-volume-item')).toBeInTheDocument(); // skips over first step when subscription is already on Business plan
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

  it('allows setting PAYG for customers switching to AM3', async () => {
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
        navigate={jest.fn()}
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

  it('handles missing categories in subscription.categories', async () => {
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
      isFree: false,
    });

    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    // For AM3, first step is pay-as-you-go budget
    expect(screen.getByText('Set Your Pay-as-you-go Budget')).toBeInTheDocument();

    // Verify that the 'Pay-as-you-go budget' is correctly set
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue('20');

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    // Verify that the component renders without errors
    expect(screen.getByTestId('replays-volume-item')).toBeInTheDocument();

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
  });

  it('handles zero platform reserve', () => {
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

  it('does not use trial volumes for trial subscriptions in AM3 checkout', async () => {
    /**
     * Test for the trial checkout slider fix in AM3 tier. When subscription.isTrial is true,
     * the checkout should use default volumes instead of trial reserved volumes.
     */
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
    });

    const trialSub = SubscriptionFixture({
      organization,
      plan: 'am3_t',
      planTier: PlanTier.AM3,
      isTrial: true, // This is true for both subscription trials and plan trials
      categories: {
        // These are high trial volumes that should NOT be used in checkout
        errors: MetricHistoryFixture({reserved: 750_000}), // High trial volume
        attachments: MetricHistoryFixture({reserved: 200}), // High trial volume
        replays: MetricHistoryFixture({reserved: 50_000}), // High trial volume
        spans: MetricHistoryFixture({reserved: 100_000_000}), // High trial volume
        monitorSeats: MetricHistoryFixture({reserved: 20}),
        profileDuration: MetricHistoryFixture({reserved: 20}),
      },
      onDemandBudgets: {
        onDemandSpendUsed: 0,
        sharedMaxBudget: 10000, // High trial budget
        budgetMode: OnDemandBudgetMode.SHARED,
        enabled: true,
      },
      onDemandMaxSpend: 10000,
      supportsOnDemand: true,
      isFree: false,
    });

    SubscriptionStore.set(organization.slug, trialSub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('heading', {name: 'Change Subscription'})
    ).toBeInTheDocument();

    // Continue to Reserved Volumes step (step 3 in AM3 checkout)
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    expect(screen.getByTestId('errors-volume-item')).toBeInTheDocument();

    // Verify that sliders show reasonable values, NOT the high trial volumes
    // The key test is that they are NOT the trial volumes we set above
    expect(screen.getByRole('slider', {name: 'Errors'})).not.toHaveAttribute(
      'aria-valuetext',
      '750000' // Should NOT be the trial value
    );
    expect(screen.getByRole('slider', {name: 'Replays'})).not.toHaveAttribute(
      'aria-valuetext',
      '50000' // Should NOT be the trial value
    );
    expect(screen.getByRole('slider', {name: 'Spans'})).not.toHaveAttribute(
      'aria-valuetext',
      '100000000' // Should NOT be the trial value
    );
    expect(screen.getByRole('slider', {name: 'Attachments'})).not.toHaveAttribute(
      'aria-valuetext',
      '200' // Should NOT be the trial value
    );

    // Verify they are reasonable default values instead
    const errorsSlider = screen.getByRole('slider', {name: 'Errors'});
    const errorsValue = parseInt(errorsSlider.getAttribute('aria-valuetext') || '0', 10);
    expect(errorsValue).toBe(50_000); // Should be much less than trial volume
    expect(errorsValue).toBeGreaterThan(0); // Should be a reasonable default

    const replaysSlider = screen.getByRole('slider', {name: 'Replays'});
    const replaysValue = parseInt(
      replaysSlider.getAttribute('aria-valuetext') || '0',
      10
    );
    expect(replaysValue).toBe(50); // Should be much less than trial volume
    expect(replaysValue).toBeGreaterThan(0); // Should be a reasonable default
  });
});
