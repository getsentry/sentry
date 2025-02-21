import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {InvoicePreviewFixture} from 'getsentry-test/fixtures/invoicePreview';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {PlanMigrationFixture} from 'getsentry-test/fixtures/planMigration';
import {RecurringCreditFixture} from 'getsentry-test/fixtures/recurringCredit';
import {
  InvoicedSubscriptionFixture,
  SubscriptionFixture,
} from 'getsentry-test/fixtures/subscription';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {CohortId, OnDemandBudgetMode, PlanTier, type Subscription} from 'getsentry/types';
import Overview from 'getsentry/views/subscriptionPage/overview';

describe('Subscription > Overview', () => {
  const organization = OrganizationFixture({access: ['org:billing']});
  const mockLocation = LocationFixture();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
      body: InvoicePreviewFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/usage/`,
      method: 'GET',
      body: CustomerUsageFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/`,
      query: {scheduled: 1, applied: 0},
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/recurring-credits/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/setup/`,
      method: 'POST',
      body: {
        id: '123',
        clientSecret: 'seti_abc123',
        status: 'require_payment_method',
        lastError: null,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });

    SubscriptionStore.set(organization.slug, {});
  });

  function assertUsageCards(subscription: Subscription, planTier: PlanTier) {
    expect(screen.getByText('Errors usage this period')).toBeInTheDocument();

    if (planTier === PlanTier.AM1) {
      expect(screen.getByText('Transactions usage this period')).toBeInTheDocument();
    } else {
      expect(
        screen.queryByText('Transactions usage this period')
      ).not.toBeInTheDocument();
    }

    if (planTier === PlanTier.AM2) {
      expect(screen.getByText('Performance units usage this period')).toBeInTheDocument();
    } else {
      expect(
        screen.queryByText('Performance units usage this period')
      ).not.toBeInTheDocument();
    }

    if ([PlanTier.MM1, PlanTier.MM2].includes(planTier)) {
      expect(screen.queryByText('Replays usage this period')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Cron monitors usage this period')
      ).not.toBeInTheDocument();
      expect(screen.queryByText('Attachments usage this period')).not.toBeInTheDocument();
    } else {
      expect(screen.getByText('Replays usage this period')).toBeInTheDocument();
      expect(screen.getByText('Cron monitors usage this period')).toBeInTheDocument();
      expect(screen.getByText('Attachments usage this period')).toBeInTheDocument();
    }

    if ([PlanTier.MM1, PlanTier.MM2, PlanTier.AM1, PlanTier.AM2].includes(planTier)) {
      expect(screen.queryByText('Spans usage this period')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Stored spans usage this period')
      ).not.toBeInTheDocument();
    } else {
      if (subscription.hadCustomDynamicSampling) {
        expect(screen.getByText('Accepted spans usage this period')).toBeInTheDocument();
        expect(screen.getByText('Stored spans usage this period')).toBeInTheDocument();
      } else {
        expect(screen.getByText('Spans usage this period')).toBeInTheDocument();
        expect(
          screen.queryByText('Stored spans usage this period')
        ).not.toBeInTheDocument();
      }
    }
  }

  it('renders for am3', async function () {
    const subscription = SubscriptionFixture({
      plan: 'am3_f',
      planTier: PlanTier.AM3,
      organization,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(screen.queryByTestId('unsupported-plan')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Manage subscription'})).toBeInTheDocument();
    assertUsageCards(subscription, PlanTier.AM3);
  });

  it('renders for am3 with custom dynamic sampling', async function () {
    const subscription = SubscriptionFixture({
      plan: 'am3_business_ent_ds_auf',
      planTier: PlanTier.AM3,
      organization,
      hadCustomDynamicSampling: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(screen.queryByTestId('unsupported-plan')).not.toBeInTheDocument();
    assertUsageCards(subscription, PlanTier.AM3);
  });

  it('renders for am2', async function () {
    const subscription = SubscriptionFixture({
      plan: 'am2_f',
      planTier: PlanTier.AM2,
      organization,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(screen.queryByTestId('unsupported-plan')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Manage subscription'})).toBeInTheDocument();
    assertUsageCards(subscription, PlanTier.AM2);
  });

  it('renders for am1', async function () {
    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(screen.queryByTestId('unsupported-plan')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Manage subscription'})).toBeInTheDocument();
    assertUsageCards(subscription, PlanTier.AM1);
  });

  it('renders for mm2', async function () {
    const subscription = SubscriptionFixture({
      plan: 'mm2_f',
      planTier: 'mm2',
      organization,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(screen.queryByTestId('unsupported-plan')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Manage subscription'})).toBeInTheDocument();
    assertUsageCards(subscription, PlanTier.MM2);
  });

  it('hides action button when subscription cannot self-serve', async function () {
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      organization,
      canSelfServe: false,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Manage subscription'})
    ).not.toBeInTheDocument();
  });

  it('enables action button when user is a billing admin', async function () {
    const billingOrg = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<Overview location={mockLocation} />, {
      organization: billingOrg,
    });

    expect(
      await screen.findByRole('button', {name: 'Manage subscription'})
    ).toBeInTheDocument();
  });

  it('renders trial card for active trial', async function () {
    const subscription = SubscriptionFixture({
      organization,
      isTrial: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByTestId('trial-alert')).toBeInTheDocument();
  });

  it('does not render trial card when not on trial', async function () {
    const subscription = SubscriptionFixture({
      organization,
      isTrial: false,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Errors usage this period')).toBeInTheDocument();
    expect(screen.queryByTestId('trial-alert')).not.toBeInTheDocument();
  });

  it('renders credit card modal on the on-demand setting for account without a credit card', async function () {
    const am1BusinessPlan = PlanDetailsLookupFixture('am1_business')!;
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      paymentSource: null,
      planDetails: {
        ...am1BusinessPlan,
      },
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(<Overview location={mockLocation} />, {organization});
    renderGlobalModal();

    expect(
      await screen.findByText(
        "To enable on-demand spend, you'll need a valid credit card on file."
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('add-cc-card')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('add-cc-card'));

    expect(await screen.findByLabelText('Card Details')).toBeInTheDocument();
  });

  it('renders on-demand config for paid account', async function () {
    const subscription = SubscriptionFixture({
      organization,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('On-Demand Max Spend')).toBeInTheDocument();
  });

  it('does not render on-demand config for invoiced account', async function () {
    const subscription = SubscriptionFixture({
      organization,
      isFree: false,
      isTrial: false,
      supportsOnDemand: false,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Errors usage this period')).toBeInTheDocument();
    expect(screen.queryByText('On-Demand Max Spend')).not.toBeInTheDocument();
  });

  it('does not render on-demand config for free account', async function () {
    const subscription = SubscriptionFixture({
      organization,
      isFree: true,
      plan: 'am1_f',
      supportsOnDemand: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Errors usage this period')).toBeInTheDocument();
    expect(screen.queryByText('On-Demand Max Spend')).not.toBeInTheDocument();
  });

  it('does not render on-demand config for subscription trial account', async function () {
    const subscription = SubscriptionFixture({
      organization,
      isFree: false,
      plan: 'am1_t',
      supportsOnDemand: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Errors usage this period')).toBeInTheDocument();
    expect(screen.queryByText('On-Demand Max Spend')).not.toBeInTheDocument();
  });

  describe('Plan Migrations', function () {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'mm2_b_100k',
      pendingChanges: {
        plan: 'mm2_a_100k',
        reservedEvents: 100000,
        onDemandMaxSpend: 0,
        effectiveDate: '2021-09-01',
        onDemandEffectiveDate: '2021-09-01',
        planDetails: {
          name: 'Business',
          contractInterval: 'monthly',
        },
      },
    });

    it('renders pending changes', async function () {
      SubscriptionStore.set(organization.slug, subscription);
      render(<Overview location={mockLocation} />, {organization});

      expect(
        await screen.findByText(/The following changes will take effect on/)
      ).toBeInTheDocument();

      expect(screen.queryByText("We're updating our")).not.toBeInTheDocument();
    });

    it('renders plan migration', async function () {
      SubscriptionStore.set(organization.slug, subscription);
      const planMigrations = [PlanMigrationFixture({cohortId: CohortId.SECOND})];
      const mockApi = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/plan-migrations/`,
        query: {scheduled: 1, applied: 0},
        method: 'GET',
        body: planMigrations,
      });

      render(<Overview location={mockLocation} />, {organization});

      expect(
        await screen.findByText(textWithMarkupMatcher("We're updating our Team Plan"))
      ).toBeInTheDocument();
      expect(
        screen.queryByText('The following changes will take effect on')
      ).not.toBeInTheDocument();

      expect(mockApi).toHaveBeenCalledTimes(1);
    });

    it('does not render already applied plan migration', async function () {
      SubscriptionStore.set(organization.slug, subscription);
      const planMigrations = [
        PlanMigrationFixture({
          cohortId: CohortId.SECOND,
          dateApplied: '2021-08-01',
        }),
      ];
      const mockApi = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/plan-migrations/`,
        query: {scheduled: 1, applied: 0},
        method: 'GET',
        body: planMigrations,
      });

      render(<Overview location={mockLocation} />, {organization});

      expect(
        await screen.findByText(/The following changes will take effect on/)
      ).toBeInTheDocument();

      expect(screen.queryByText("We're updating our")).not.toBeInTheDocument();

      expect(mockApi).toHaveBeenCalledTimes(1);
    });
  });

  describe('Recurring Credits', function () {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'mm2_b_100k',
    });

    it('renders empty', async function () {
      SubscriptionStore.set(organization.slug, subscription);
      render(<Overview location={mockLocation} />, {organization});

      expect(await screen.findByText('Errors usage this period')).toBeInTheDocument();
      expect(screen.queryByTestId('recurring-credits-panel')).not.toBeInTheDocument();
    });

    it('renders recurring credits', async function () {
      SubscriptionStore.set(organization.slug, subscription);
      const mockApi = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/recurring-credits/`,
        method: 'GET',
        body: [RecurringCreditFixture()],
      });

      render(<Overview location={mockLocation} />, {organization});

      expect(await screen.findByTestId('recurring-credits-panel')).toBeInTheDocument();

      expect(mockApi).toHaveBeenCalledTimes(1);
    });
  });

  it('does not render OnDemandBudgets for AM1 orgs without ondemand-budgets feature flag', async function () {
    const billingOrg = OrganizationFixture({
      features: [],
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      planDetails: {
        ...PlanDetailsLookupFixture('am1_business')!,
      },
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<Overview location={mockLocation} organization={billingOrg} />, {
      organization,
    });

    expect(await screen.findByText('On-Demand Max Spend')).toBeInTheDocument();
    expect(screen.queryByText('on-demand budget')).not.toBeInTheDocument();
  });

  it('does not render OnDemandBudgets for MM2 orgs with ondemand-budgets feature flag', async function () {
    const billingOrg = OrganizationFixture({
      features: ['ondemand-budgets'],
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      plan: 'mm2_a_100k',
      planTier: 'mm2',
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      onDemandMaxSpend: 1000,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<Overview location={mockLocation} organization={billingOrg} />, {
      organization,
    });

    expect(await screen.findByText('On-Demand Max Spend')).toBeInTheDocument();
    expect(screen.queryByText('on-demand budget')).not.toBeInTheDocument();
  });

  it('does not render OnDemandBudgets for AM1 orgs without ondemand-budgets dictionary', async function () {
    const billingOrg = OrganizationFixture({
      features: ['ondemand-budgets'],
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      planDetails: {
        ...PlanDetailsLookupFixture('am1_business')!,
      },
      organization: billingOrg,
      // onDemandBudgets is missing
    });
    expect('onDemandBudgets' in subscription).toBe(false);
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<Overview location={mockLocation} organization={billingOrg} />, {
      organization,
    });

    expect(await screen.findByText('On-Demand Max Spend')).toBeInTheDocument();
    expect(screen.queryByText('on-demand budget')).not.toBeInTheDocument();
  });

  it('renders on-demand edit modal for AM3 orgs without ondemand-budgets dictionary', async function () {
    const billingOrg = OrganizationFixture({
      features: ['ondemand-budgets'],
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      plan: 'am3_business',
      // AM3 does not support on-demand budgets
      // hasOnDemandModes is false
      planTier: PlanTier.AM3,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization: billingOrg,
      onDemandBudgets: {
        enabled: false,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<Overview location={mockLocation} organization={billingOrg} />, {
      organization,
    });

    expect(
      await screen.findByRole('button', {name: 'Set Up Pay-as-you-go'})
    ).toBeInTheDocument();
  });

  it('renders OnDemandBudgets for AM1 orgs with ondemand-budgets feature flag', async function () {
    const billingOrg = OrganizationFixture({
      features: ['ondemand-budgets'],
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      planDetails: {
        ...PlanDetailsLookupFixture('am1_business')!,
      },
      organization: billingOrg,
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 4200,
        enabled: true,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<Overview location={mockLocation} organization={billingOrg} />, {
      organization,
    });

    expect(
      await screen.findByText(
        'Your on-demand budget is shared among all categories on a first come, first serve basis. There are no restrictions for any single category consuming the entire budget.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('On-Demand Max Spend')).not.toBeInTheDocument();
  });

  it('renders OnDemandBudgets for invoiced orgs with ondemand-budgets feature flag and manually invoiced on-demand max spend', async function () {
    const billingOrg = OrganizationFixture({
      features: ['ondemand-budgets'],
      access: ['org:billing'],
    });
    const subscription = InvoicedSubscriptionFixture({
      plan: 'am2_business_auf',
      isFree: false,
      isTrial: false,
      organization: billingOrg,
      onDemandInvoicedManual: true,
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 4200,
        enabled: true,
        onDemandSpendUsed: 0,
      },
      supportsOnDemand: true,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<Overview location={mockLocation} organization={billingOrg} />, {
      organization,
    });

    expect(
      await screen.findByText(
        'Your on-demand budget is shared among all categories on a first come, first serve basis. There are no restrictions for any single category consuming the entire budget.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('On-Demand Max Spend')).not.toBeInTheDocument();
    expect(await screen.findByText('Edit')).toBeInTheDocument();
  });

  it('does not render OnDemandBudgets for invoiced orgs with ondemand-budgets feature flag and disabled manually invoiced on-demand max spend', async function () {
    const billingOrg = OrganizationFixture({
      features: ['ondemand-budgets'],
      access: ['org:billing'],
    });
    const subscription = InvoicedSubscriptionFixture({
      plan: 'am2_business_auf',
      isFree: false,
      isTrial: false,
      organization: billingOrg,
      onDemandInvoicedManual: false,
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
        enabled: false,
        onDemandSpendUsed: 0,
      },
      supportsOnDemand: false,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<Overview location={mockLocation} organization={billingOrg} />, {
      organization,
    });

    expect(await screen.findByText('Errors usage this period')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Your on-demand budget is shared among all categories on a first come, first serve basis. There are no restrictions for any single category consuming the entire budget.'
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText('On-Demand Max Spend')).not.toBeInTheDocument();
  });

  it('displays limited context for members', async function () {
    const billingOrg = OrganizationFixture({
      access: [],
    });
    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<Overview location={mockLocation} organization={billingOrg} />, {
      organization,
    });

    expect(await screen.findByTestId('usage-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('recurring-credits-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('spike-protection-details')).not.toBeInTheDocument();
    expect(screen.queryByTestId('permission-denied')).not.toBeInTheDocument();
  });

  it('renders ContactBillingMembers for members on managed accounts', async function () {
    const billingOrg = OrganizationFixture({
      access: [],
    });
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      organization: billingOrg,
      canSelfServe: false,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<Overview location={mockLocation} organization={billingOrg} />, {
      organization,
    });

    expect(await screen.findByTestId('permission-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('usage-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recurring-credits-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('spike-protection-details')).not.toBeInTheDocument();
  });

  it('opens codecov modal', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/codecov-jwt/`,
      method: 'GET',
      body: {token: 'my-token'},
    });
    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization,
    });
    SubscriptionStore.set(organization.slug, subscription);
    const location = LocationFixture({
      query: {open_codecov_modal: '1'},
    });

    render(<Overview location={location} />, {
      organization,
    });
    renderGlobalModal();

    expect(await screen.findByText('Try Code Coverage')).toBeInTheDocument();
  });

  it('renders for am1 no product trial', async function () {
    const subscription = SubscriptionFixture({
      plan: 'am1_team',
      planTier: PlanTier.AM1,
      organization,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(await screen.findByText('Errors usage this period')).toBeInTheDocument();
    expect(screen.queryByText('Trial Available')).not.toBeInTheDocument();
  });

  describe('OnDemandDisabled', function () {
    it('renders alert when on-demand is disabled', async function () {
      const subscription = SubscriptionFixture({
        organization,
        onDemandDisabled: true,
        onDemandMaxSpend: 1000,
      });
      SubscriptionStore.set(organization.slug, subscription);

      render(<Overview location={mockLocation} />, {organization});

      expect(await screen.findByTestId('ondemand-disabled-alert')).toBeInTheDocument();
      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'On-demand billing is disabled for your organization due to an unpaid on-demand invoice.'
          )
        )
      ).toBeInTheDocument();
    });

    it('renders alert when on-demand is disabled with billing permissions', async function () {
      const billingOrg = OrganizationFixture({access: ['org:billing']});
      const subscription = SubscriptionFixture({
        organization: billingOrg,
        onDemandDisabled: true,
        onDemandMaxSpend: 1000,
      });
      SubscriptionStore.set(billingOrg.slug, subscription);

      render(<Overview location={mockLocation} organization={billingOrg} />, {
        organization: billingOrg,
      });

      expect(await screen.findByTestId('ondemand-disabled-alert')).toBeInTheDocument();
      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'On-demand billing is disabled for your organization due to an unpaid on-demand invoice.'
          )
        )
      ).toBeInTheDocument();
    });

    it('renders alert when on-demand is disabled without billing permissions', async function () {
      const nonBillingOrg = OrganizationFixture({access: []});
      const subscription = SubscriptionFixture({
        organization: nonBillingOrg,
        onDemandDisabled: true,
        onDemandMaxSpend: 1000,
        canSelfServe: true,
      });
      SubscriptionStore.set(nonBillingOrg.slug, subscription);

      render(<Overview location={mockLocation} organization={nonBillingOrg} />, {
        organization: nonBillingOrg,
      });

      expect(await screen.findByTestId('ondemand-disabled-alert')).toBeInTheDocument();
      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'On-demand billing is disabled for your organization due to an unpaid on-demand invoice.'
          )
        )
      ).toBeInTheDocument();
    });

    it('does not render alert when on-demand is not disabled', async function () {
      const subscription = SubscriptionFixture({
        organization,
        onDemandDisabled: false,
        onDemandMaxSpend: 1000,
      });
      SubscriptionStore.set(organization.slug, subscription);

      render(<Overview location={mockLocation} />, {organization});

      expect(await screen.findByText('Errors usage this period')).toBeInTheDocument();
      expect(screen.queryByTestId('ondemand-disabled-alert')).not.toBeInTheDocument();
    });

    it('uses pay-as-you-go terminology for AM3 plans', async function () {
      const subscription = SubscriptionFixture({
        organization,
        onDemandDisabled: true,
        onDemandMaxSpend: 1000,
        planTier: PlanTier.AM3,
      });
      SubscriptionStore.set(organization.slug, subscription);

      render(<Overview location={mockLocation} />, {organization});

      expect(await screen.findByTestId('ondemand-disabled-alert')).toBeInTheDocument();
      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'Pay-as-you-go billing is disabled for your organization due to an unpaid pay-as-you-go invoice.'
          )
        )
      ).toBeInTheDocument();
    });
  });
});
