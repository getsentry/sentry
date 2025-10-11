import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {OnDemandBudgetMode, PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout';

describe('SetPayAsYouGo', () => {
  const api = new MockApiClient();
  const organization = OrganizationFixture({
    features: ['ondemand-budgets', 'am3-billing'],
  });

  const stepBody =
    /Pay-as-you-go applies across all Sentry products, on a first-come, first-served basis./;

  async function openPanel(planChoice: 'Business' | 'Team' = 'Business') {
    expect(await screen.findByTestId('header-choose-your-plan')).toBeInTheDocument();
    const selectedRadio = screen.getByRole('radio', {name: planChoice});
    await userEvent.click(selectedRadio);
    expect(selectedRadio).toBeChecked();
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
  }

  beforeEach(() => {
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

  it('renders with business plan and default PAYG budget by default for new customers', async () => {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: PlanTier.AM3,
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
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
    expect(screen.getByText(/Suggested Amount/)).toBeInTheDocument();
  });

  it('renders with team plan and default PAYG budget by default for new customers', async () => {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: PlanTier.AM3,
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
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
    expect(screen.getByText(/Suggested Amount/)).toBeInTheDocument();
  });

  it('renders with existing PAYG budget', async () => {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      planTier: PlanTier.AM3,
      onDemandMaxSpend: 30_00,
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 30_00,
        enabled: true,
        onDemandSpendUsed: 0,
      },
      isFree: false,
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM3}
        onToggleLegacy={jest.fn()}
      />
    );
    await openPanel();

    expect(screen.getByText(stepBody)).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue('30');
    expect(screen.queryByText(/Suggested Amount/)).not.toBeInTheDocument();
  });

  it('can complete step', async () => {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: PlanTier.AM3,
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
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

  it('renders with closest plan and default PAYG budget by default for customers migrating from partner billing', async () => {
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
        navigate={jest.fn()}
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
    expect(screen.getByText(/Suggested Amount/)).toBeInTheDocument();
  });

  it('renders warnings when setting PAYG budget to 0', async () => {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: PlanTier.AM3,
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM3}
        onToggleLegacy={jest.fn()}
      />
    );
    await openPanel();

    expect(screen.getByText(stepBody)).toBeInTheDocument();
    expect(
      screen.queryByText(
        /Setting this to \$0 may result in you losing the ability to fully monitor your applications within Sentry/
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Products locked/)).not.toBeInTheDocument();

    // set to 0
    await userEvent.clear(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'}));
    expect(
      await screen.findByRole('textbox', {name: 'Pay-as-you-go budget'})
    ).toHaveValue('0');
    expect(
      screen.getByText(
        /Setting this to \$0 may result in you losing the ability to fully monitor your applications within Sentry/
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Products locked/)).toBeInTheDocument();
  });

  it('can increment and decrement PAYG budget with buttons', async () => {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: PlanTier.AM3,
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
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

    await userEvent.click(screen.getByRole('button', {name: 'Increase'}));
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue(
      '125'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Decrease'}));
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue(
      '100'
    );

    // should not go below 0
    await userEvent.click(screen.getByRole('button', {name: 'Decrease'}));
    await userEvent.click(screen.getByRole('button', {name: 'Decrease'}));
    await userEvent.click(screen.getByRole('button', {name: 'Decrease'}));
    await userEvent.click(screen.getByRole('button', {name: 'Decrease'}));
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue('0');
    await userEvent.click(screen.getByRole('button', {name: 'Decrease'}));
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue('0');
  });

  it('updates when default budget changes', async () => {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: PlanTier.AM3,
    });
    act(() => SubscriptionStore.set(organization.slug, sub));
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM3}
        onToggleLegacy={jest.fn()}
      />
    );
    await openPanel();

    // renders with default business budget
    expect(screen.getByText(stepBody)).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue(
      '300'
    );

    // go back to plan select
    await userEvent.click(screen.getByText('Choose Your Plan'));
    expect(await screen.findByTestId('header-choose-your-plan')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', {name: 'Team'}));
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    // renders with default team budget
    expect(screen.getByText(stepBody)).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue(
      '100'
    );
  });
});
