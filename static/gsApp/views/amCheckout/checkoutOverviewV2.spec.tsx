import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';
import CheckoutOverviewV2 from 'getsentry/views/amCheckout/checkoutOverviewV2';
import type {CheckoutFormData} from 'getsentry/views/amCheckout/types';

describe('CheckoutOverviewV2', function () {
  const api = new MockApiClient();
  const {organization, routerProps} = initializeOrg();
  const subscription = SubscriptionFixture({organization, plan: 'am3_f'});
  const params = {};

  const billingConfig = BillingConfigFixture(PlanTier.AM3);
  const teamPlanAnnual = PlanDetailsLookupFixture('am3_team_auf')!;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
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
      body: BillingConfigFixture(PlanTier.AM3),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
  });

  it('initializes with business plan and unset budget when on AM3 developer plan', async function () {
    render(
      <AMCheckout
        {...routerProps}
        api={api}
        checkoutTier={PlanTier.AM3}
        onToggleLegacy={jest.fn()}
        params={params}
      />
    );

    expect(await screen.findByTestId('checkout-overview-v2')).toBeInTheDocument();
    expect(screen.getByText('Sentry Business Plan')).toBeInTheDocument();
    expect(
      screen.getByText('This is your standard monthly subscription charge.')
    ).toBeInTheDocument();
    expect(screen.getAllByText('$89/mo')).toHaveLength(2);
    expect(screen.queryByTestId('additional-monthly-charge')).not.toBeInTheDocument();
    expect(screen.getByText('Monthly Reserved Volumes')).toBeInTheDocument();
    expect(screen.getByText('Billed Monthly')).toBeInTheDocument();
  });

  it('renders with existing plan', function () {
    const formData: CheckoutFormData = {
      plan: 'am3_team_auf',
      reserved: {
        errors: 100000,
        attachments: 25,
        replays: 50,
        spans: 10_000_000,
        monitorSeats: 1,
        profileDuration: 50,
      },
      onDemandMaxSpend: 5000,
    };

    render(
      <CheckoutOverviewV2
        activePlan={teamPlanAnnual}
        billingConfig={billingConfig}
        formData={formData}
        onUpdate={jest.fn()}
        organization={organization}
        subscription={subscription}
      />
    );

    expect(screen.getByText('Sentry Team Plan')).toBeInTheDocument();
    expect(screen.getByText('Monthly Reserved Volumes')).toBeInTheDocument();
    expect(screen.getByText('Billed Annually')).toBeInTheDocument();
    expect(screen.getByText('$312/yr')).toBeInTheDocument();
    expect(screen.getByTestId('additional-monthly-charge')).toHaveTextContent(
      '+ up to $50/mo based on PAYG usage'
    );
    expect(screen.getByTestId('attachments-reserved')).toHaveTextContent(
      '25 GB Attachments+ $65/yr'
    );
    expect(screen.getByTestId('errors-reserved')).toHaveTextContent(
      '100,000 Errors+ $162/yr'
    );
    // Shows "included" for categories with no additional spend
    expect(screen.getByTestId('replays-reserved')).toHaveTextContent(
      '50 ReplaysIncluded'
    );
    expect(screen.getByTestId('spans-reserved')).toHaveTextContent(
      '10,000,000 SpansIncluded'
    );
    expect(screen.getByTestId('monitorSeats-reserved')).toHaveTextContent(
      '1 Cron monitorIncluded'
    );
    expect(screen.getByTestId('profileDuration-reserved')).toHaveTextContent(
      '50 Profile hoursIncluded'
    );
    expect(screen.queryByTestId('spansIndexed-reserved')).not.toBeInTheDocument();
    expect(
      screen.getByText('This is your standard yearly subscription charge.')
    ).toBeInTheDocument();
  });

  it('hides payg budget when setting to zero', function () {
    const formData: CheckoutFormData = {
      plan: 'am3_team_auf',
      reserved: {
        errors: 100000,
        attachments: 25,
        replays: 500,
        monitorSeats: 1,
      },
      onDemandMaxSpend: 0,
    };

    render(
      <CheckoutOverviewV2
        activePlan={teamPlanAnnual}
        billingConfig={billingConfig}
        formData={formData}
        onUpdate={jest.fn()}
        organization={organization}
        subscription={subscription}
      />
    );

    expect(screen.getByText('Sentry Team Plan')).toBeInTheDocument();
    expect(screen.queryByTestId('additional-monthly-charge')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional Coverage')).not.toBeInTheDocument();
  });
});
