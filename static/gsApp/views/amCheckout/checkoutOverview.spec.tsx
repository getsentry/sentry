import {LocationFixture} from 'sentry-fixture/locationFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {OnDemandBudgetMode, PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';
import CheckoutOverview from 'getsentry/views/amCheckout/checkoutOverview';
import type {CheckoutFormData} from 'getsentry/views/amCheckout/types';

describe('CheckoutOverview', function () {
  const api = new MockApiClient();
  const {organization, routerProps} = initializeOrg();
  const subscription = SubscriptionFixture({organization, plan: 'am1_f'});
  const params = {};

  const billingConfig = BillingConfigFixture(PlanTier.AM2);
  const teamPlanAnnual = PlanDetailsLookupFixture('am1_team_auf')!;
  const teamPlanMonthly = PlanDetailsLookupFixture('am2_team')!;

  beforeEach(function () {
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM2),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
  });

  it('renders with default plan', async function () {
    render(
      <AMCheckout
        {...routerProps}
        api={api}
        checkoutTier={PlanTier.AM2}
        onToggleLegacy={jest.fn()}
        params={params}
      />
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
  });

  it('renders breakdown for team annual plan', function () {
    const formData = {
      plan: 'am1_team_auf',
      reserved: {errors: 100000, transactions: 500000, attachments: 25},
      onDemandMaxSpend: 5000,
    };

    render(
      <CheckoutOverview
        activePlan={teamPlanAnnual}
        billingConfig={billingConfig}
        formData={formData}
        onUpdate={jest.fn()}
        organization={organization}
        subscription={subscription}
      />
    );
  });

  it('changes initial step number based on url location.hash', async function () {
    render(
      <AMCheckout
        {...routerProps}
        api={api}
        checkoutTier={PlanTier.AM1}
        location={LocationFixture({hash: '#step3'})}
        onToggleLegacy={jest.fn()}
        params={params}
      />
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    // Should show description for step 3 (on-demand max spend)
    expect(
      screen.getByText(/On-Demand spend allows you to pay for additional data/i)
    ).toBeInTheDocument();
  });

  it('renders On-Demand max along with team annual plan', () => {
    const formData: CheckoutFormData = {
      plan: 'am2_team',
      reserved: {errors: 100000, transactions: 500000, attachments: 25},
      onDemandBudget: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 5000,
      },
    };

    render(
      <CheckoutOverview
        activePlan={teamPlanMonthly}
        billingConfig={billingConfig}
        formData={formData}
        onUpdate={jest.fn()}
        organization={organization}
        subscription={subscription}
      />
    );

    expect(screen.getByTestId('on-demand-additional-cost')).toHaveTextContent(
      '+ On-Demand charges up to $50/mo based on usage'
    );
  });

  it('renders On-Demand with monthly total for annual plan', () => {
    const formData: CheckoutFormData = {
      plan: 'am2_team',
      reserved: {errors: 100000, transactions: 500000, attachments: 25},
      onDemandBudget: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 5000,
      },
    };

    render(
      <CheckoutOverview
        activePlan={teamPlanAnnual}
        billingConfig={billingConfig}
        formData={formData}
        onUpdate={jest.fn()}
        organization={organization}
        subscription={subscription}
      />
    );

    expect(screen.getByTestId('on-demand-additional-cost')).toHaveTextContent(
      '+ On-Demand charges up to $50/mo based on usage'
    );
  });

  it('hides On-Demand max when On-Demand is $0', () => {
    const formData: CheckoutFormData = {
      plan: 'am2_team',
      reserved: {errors: 100000, transactions: 500000, attachments: 25},
      onDemandBudget: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
      },
    };

    render(
      <CheckoutOverview
        activePlan={teamPlanMonthly}
        billingConfig={billingConfig}
        formData={formData}
        onUpdate={jest.fn()}
        organization={organization}
        subscription={subscription}
      />
    );

    expect(screen.getByText('Team Plan')).toBeInTheDocument();
    expect(screen.queryByTestId('on-demand-additional-cost')).not.toBeInTheDocument();
  });
});
