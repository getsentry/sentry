import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {OnDemandBudgetMode, PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout';

describe('SetBudgetAndReserves', function () {
  const api = new MockApiClient();
  const organization = OrganizationFixture({
    features: ['ondemand-budgets', 'am3-billing'],
  });
  const params = {};

  const stepBody =
    /This budget ensures continued monitoring after you've used up your reserved event volume/;

  async function openPanel(planChoice: 'Business' | 'Team' = 'Business') {
    expect(await screen.findByTestId('header-choose-your-plan')).toBeInTheDocument();
    const selectedRadio = screen.getByRole('radio', {name: planChoice});
    await userEvent.click(selectedRadio);
    expect(selectedRadio).toBeChecked();
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
  }

  beforeEach(function () {
    MockApiClient.clearMockResponses();
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
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: [],
    });
  });

  it('renders with business plan and default PAYG budget by default for new customers', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: PlanTier.AM3,
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM3}
        onToggleLegacy={jest.fn()}
      />
    );
    await openPanel();

    expect(screen.getByText(stepBody)).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue(
      '300'
    );
  });

  it('renders with team plan and default PAYG budget by default for new customers', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: PlanTier.AM3,
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM3}
        onToggleLegacy={jest.fn()}
      />
    );
    await openPanel('Team');

    expect(screen.getByText(stepBody)).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue(
      '100'
    );
  });

  it('renders with existing PAYG budget and reserved volumes', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      planTier: PlanTier.AM3,
      categories: {
        errors: MetricHistoryFixture({reserved: 100_000}),
        attachments: MetricHistoryFixture({reserved: 25}),
        replays: MetricHistoryFixture({reserved: 50}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
        spans: MetricHistoryFixture({reserved: 10_000_000}),
        profileDuration: MetricHistoryFixture({reserved: 1}),
      },
      onDemandMaxSpend: 30_00,
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 30_00,
        enabled: true,
        onDemandSpendUsed: 0,
      },
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM3}
        onToggleLegacy={jest.fn()}
      />
    );
    await openPanel();

    expect(screen.getByText(stepBody)).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue('30');
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
      '10000000'
    );
    expect(screen.getByRole('slider', {name: 'Attachments'})).toHaveAttribute(
      'aria-valuetext',
      '25'
    );
  });

  it('can complete step', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: PlanTier.AM3,
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM3}
        onToggleLegacy={jest.fn()}
      />
    );
    await openPanel();

    expect(screen.getByText(stepBody)).toBeInTheDocument();

    // continue to close
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    expect(screen.queryByText(stepBody)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'Pay-as-you-go budget'})
    ).not.toBeInTheDocument();
  });

  it('renders with closest plan and default PAYG budget by default for customers migrating from partner billing', async function () {
    organization.features.push('partner-billing-migration');
    const sub = SubscriptionFixture({
      organization,
      plan: 'am2_sponsored_team_auf',
      planTier: PlanTier.AM2,
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
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM3}
        onToggleLegacy={jest.fn()}
      />
    );
    await openPanel('Team');

    expect(screen.getByText(stepBody)).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue(
      '100'
    );
  });

  it('omits monitor seats, stored spans, and profile duration from volume sliders', async function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      planTier: PlanTier.AM3,
      categories: {
        errors: MetricHistoryFixture({reserved: 100_000}),
        attachments: MetricHistoryFixture({reserved: 25}),
        replays: MetricHistoryFixture({reserved: 50}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
        spans: MetricHistoryFixture({reserved: 1}),
        profileDuration: MetricHistoryFixture({reserved: 1}),
      },
      onDemandMaxSpend: 30_00,
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 30_00,
        enabled: true,
        onDemandSpendUsed: 0,
      },
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM3}
        onToggleLegacy={jest.fn()}
      />
    );
    await openPanel();

    // Verify monitor seats slider is not rendered
    expect(screen.queryByRole('slider', {name: 'Cron Monitors'})).not.toBeInTheDocument();
    expect(screen.queryByTestId('monitorSeats-volume-item')).not.toBeInTheDocument();

    // Verify stored spans slider is not rendered
    expect(screen.queryByRole('slider', {name: 'Stored Spans'})).not.toBeInTheDocument();
    expect(screen.queryByTestId('spansIndexed-volume-item')).not.toBeInTheDocument();

    // Verify profile duration slider is not rendered
    expect(
      screen.queryByRole('slider', {name: 'Profile Duration'})
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-duration-volume-item')).not.toBeInTheDocument();

    // Verify accepted spans slider is rendered but without 'Accepted' in the label
    expect(
      screen.queryByRole('slider', {name: 'Accepted Spans'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('slider', {name: 'Spans'})).toBeInTheDocument();

    // Verify other sliders are still rendered
    expect(screen.getByRole('slider', {name: 'Errors'})).toBeInTheDocument();
    expect(screen.getByRole('slider', {name: 'Replays'})).toBeInTheDocument();
    expect(screen.getByRole('slider', {name: 'Attachments'})).toBeInTheDocument();
  });
});
