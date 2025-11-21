import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {InvoicePreviewFixture} from 'getsentry-test/fixtures/invoicePreview';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {PlanMigrationFixture} from 'getsentry-test/fixtures/planMigration';
import {RecurringCreditFixture} from 'getsentry-test/fixtures/recurringCredit';
import {
  Am3DsEnterpriseSubscriptionFixture,
  InvoicedSubscriptionFixture,
  SubscriptionFixture,
  SubscriptionWithLegacySeerFixture,
} from 'getsentry-test/fixtures/subscription';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {PendingChangesFixture} from 'getsentry/__fixtures__/pendingChanges';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {CohortId, OnDemandBudgetMode, PlanTier, type Subscription} from 'getsentry/types';
import {isAm3DsPlan} from 'getsentry/utils/billing';
import Overview from 'getsentry/views/subscriptionPage/overview';

describe('Subscription > Overview', () => {
  const organization = OrganizationFixture({access: ['org:billing']});
  const mockLocation = LocationFixture();

  beforeEach(() => {
    organization.features = [];
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
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/next-bill/`,
      method: 'GET',
    });

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/history/current/`,
      method: 'GET',
    });

    SubscriptionStore.set(organization.slug, {});
  });

  function assertUsageCards(subscription: Subscription) {
    expect(screen.getByText('Errors usage this period')).toBeInTheDocument();

    const planTier = subscription.planTier as PlanTier;

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
      expect(screen.queryByText('Seer')).not.toBeInTheDocument();
    } else {
      expect(screen.getByText('Replays usage this period')).toBeInTheDocument();
      expect(screen.getByText('Cron monitors usage this period')).toBeInTheDocument();
      expect(screen.getByText('Attachments usage this period')).toBeInTheDocument();
      expect(screen.getByText('Seer')).toBeInTheDocument();
    }

    if ([PlanTier.MM1, PlanTier.MM2, PlanTier.AM1, PlanTier.AM2].includes(planTier)) {
      expect(screen.queryByText('Spans usage this period')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Stored spans usage this period')
      ).not.toBeInTheDocument();
    } else if (isAm3DsPlan(subscription.plan) && !subscription.isEnterpriseTrial) {
      expect(screen.getByText('Spans budget')).toBeInTheDocument();
      if (subscription.hadCustomDynamicSampling) {
        expect(
          screen.getByText('Accepted Spans Included in Subscription')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Stored Spans Included in Subscription')
        ).toBeInTheDocument();
      } else {
        expect(screen.queryByText('Accepted spans')).not.toBeInTheDocument();
        expect(screen.queryByText('Stored spans')).not.toBeInTheDocument();
      }
    } else {
      expect(screen.getByText('Spans usage this period')).toBeInTheDocument();
      expect(
        screen.queryByText('Stored spans usage this period')
      ).not.toBeInTheDocument();
    }
  }

  it('renders for new billing UI', async () => {
    const subscription = SubscriptionFixture({organization, plan: 'am3_business'});
    SubscriptionStore.set(organization.slug, subscription);
    organization.features = ['subscriptions-v3'];
    render(<Overview location={mockLocation} />, {organization});
    expect(
      await screen.findByRole('heading', {name: 'Subscription'})
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Next bill'})).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Billing information'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Receipts & notifications'})
    ).toBeInTheDocument();
    expect(screen.getByText('Business plan')).toBeInTheDocument();
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
  });

  it('renders for am3 DS plan without custom dynamic sampling toggled', async () => {
    const subscription = Am3DsEnterpriseSubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(screen.queryByTestId('unsupported-plan')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Manage subscription'})
    ).not.toBeInTheDocument();
    assertUsageCards(subscription);
  });

  it('renders for am3 DS plan with custom dynamic sampling toggled', async () => {
    const subscription = Am3DsEnterpriseSubscriptionFixture({
      organization,
      hadCustomDynamicSampling: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(screen.queryByTestId('unsupported-plan')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Manage subscription'})
    ).not.toBeInTheDocument();
    assertUsageCards(subscription);
  });

  it('renders for am3 DS enterprise trial', async () => {
    const subscription = SubscriptionFixture({
      organization,
      isEnterpriseTrial: true,
      plan: 'am3_t_ent_ds',
      planTier: PlanTier.AM3,
      canSelfServe: false,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(screen.queryByTestId('unsupported-plan')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Manage subscription'})
    ).not.toBeInTheDocument();
    assertUsageCards(subscription);
  });

  it('renders with Seer', async () => {
    const seerSubscription = SubscriptionWithLegacySeerFixture({
      organization,
    });
    SubscriptionStore.set(organization.slug, seerSubscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(screen.queryByTestId('unsupported-plan')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Manage subscription'})).toBeInTheDocument();
    assertUsageCards(seerSubscription);
    expect(screen.getByText('Issue Fixes Included in Subscription')).toBeInTheDocument();
    expect(screen.getByText('Issue Scans Included in Subscription')).toBeInTheDocument();
  });

  it('renders Seer upsell on developer plan', async () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: PlanTier.AM3,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(screen.queryByTestId('unsupported-plan')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Manage subscription'})).toBeInTheDocument();
    assertUsageCards(subscription);

    expect(screen.queryByTestId('usage-card-seerAutofix')).not.toBeInTheDocument();
    expect(screen.queryByTestId('usage-card-seerScanner')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Issue Fixes Included in Subscription')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Issue Scans Included in Subscription')
    ).not.toBeInTheDocument();
  });

  it('renders for am3', async () => {
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
    assertUsageCards(subscription);
  });

  it('renders for am2', async () => {
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
    assertUsageCards(subscription);
  });

  it('renders for am1', async () => {
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
    assertUsageCards(subscription);
  });

  it('renders for mm2', async () => {
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
    assertUsageCards(subscription);
  });

  it('hides action button when subscription cannot self-serve', async () => {
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

  it('enables action button when user is a billing admin', async () => {
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

  it('renders trial card for active trial', async () => {
    const subscription = SubscriptionFixture({
      organization,
      isTrial: true,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByTestId('trial-alert')).toBeInTheDocument();
  });

  it('does not render trial card when not on trial', async () => {
    const subscription = SubscriptionFixture({
      organization,
      isTrial: false,
    });
    SubscriptionStore.set(organization.slug, subscription);

    render(<Overview location={mockLocation} />, {organization});

    expect(await screen.findByText('Errors usage this period')).toBeInTheDocument();
    expect(screen.queryByTestId('trial-alert')).not.toBeInTheDocument();
  });

  it('renders credit card modal on the on-demand setting for account without a credit card', async () => {
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

  it('renders on-demand config for paid account', async () => {
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

  it('does not render on-demand config for invoiced account', async () => {
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

  it('does not render on-demand config for free account', async () => {
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

  it('does not render on-demand config for subscription trial account', async () => {
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

  describe('Plan Migrations', () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'mm2_b_100k',
      pendingChanges: PendingChangesFixture({
        plan: 'mm2_a_100k',
        onDemandMaxSpend: 0,
        effectiveDate: '2021-09-01',
        onDemandEffectiveDate: '2021-09-01',
        planDetails: PlanDetailsLookupFixture('mm2_a_100k')!,
      }),
    });

    it('renders pending changes', async () => {
      SubscriptionStore.set(organization.slug, subscription);
      render(<Overview location={mockLocation} />, {organization});

      expect(
        await screen.findByText(/The following changes will take effect on/)
      ).toBeInTheDocument();

      expect(screen.queryByText("We're updating our")).not.toBeInTheDocument();
    });

    it('renders plan migration', async () => {
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

    it('does not render already applied plan migration', async () => {
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

  describe('Recurring Credits', () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'mm2_b_100k',
    });

    it('renders empty', async () => {
      SubscriptionStore.set(organization.slug, subscription);
      render(<Overview location={mockLocation} />, {organization});

      expect(await screen.findByText('Errors usage this period')).toBeInTheDocument();
      expect(screen.queryByTestId('recurring-credits-panel')).not.toBeInTheDocument();
    });

    it('renders recurring credits', async () => {
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

  it('does not render OnDemandBudgets for AM1 orgs without ondemand-budgets feature flag', async () => {
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

    render(<Overview location={mockLocation} />, {
      organization: billingOrg,
    });

    expect(await screen.findByText('On-Demand Max Spend')).toBeInTheDocument();
    expect(screen.queryByText('on-demand budget')).not.toBeInTheDocument();
  });

  it('does not render OnDemandBudgets for MM2 orgs with ondemand-budgets feature flag', async () => {
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

    render(<Overview location={mockLocation} />, {
      organization: billingOrg,
    });

    expect(await screen.findByText('On-Demand Max Spend')).toBeInTheDocument();
    expect(screen.queryByText('on-demand budget')).not.toBeInTheDocument();
  });

  it('does not render OnDemandBudgets for AM1 orgs without ondemand-budgets dictionary', async () => {
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

    render(<Overview location={mockLocation} />, {organization: billingOrg});

    expect(await screen.findByText('On-Demand Max Spend')).toBeInTheDocument();
    expect(screen.queryByText('on-demand budget')).not.toBeInTheDocument();
  });

  it('renders on-demand edit modal for AM3 orgs without ondemand-budgets dictionary', async () => {
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

    render(<Overview location={mockLocation} />, {organization: billingOrg});

    expect(
      await screen.findByRole('button', {name: 'Set Up Pay-as-you-go'})
    ).toBeInTheDocument();
  });

  it('renders OnDemandBudgets for AM1 orgs with ondemand-budgets feature flag', async () => {
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

    render(<Overview location={mockLocation} />, {organization: billingOrg});

    expect(
      await screen.findByText(
        'Your on-demand budget is shared among all categories on a first come, first serve basis. There are no restrictions for any single category consuming the entire budget.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('On-Demand Max Spend')).not.toBeInTheDocument();
  });

  it('renders OnDemandBudgets for invoiced orgs with ondemand-budgets feature flag and manually invoiced on-demand max spend', async () => {
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

    render(<Overview location={mockLocation} />, {organization: billingOrg});

    expect(
      await screen.findByText(
        'Your on-demand budget is shared among all categories on a first come, first serve basis. There are no restrictions for any single category consuming the entire budget.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('On-Demand Max Spend')).not.toBeInTheDocument();
    expect(await screen.findByText('Edit')).toBeInTheDocument();
  });

  it('does not render OnDemandBudgets for invoiced orgs with ondemand-budgets feature flag and disabled manually invoiced on-demand max spend', async () => {
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

    render(<Overview location={mockLocation} />, {organization: billingOrg});

    expect(await screen.findByText('Errors usage this period')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Your on-demand budget is shared among all categories on a first come, first serve basis. There are no restrictions for any single category consuming the entire budget.'
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText('On-Demand Max Spend')).not.toBeInTheDocument();
  });

  it('displays limited context for members', async () => {
    const billingOrg = OrganizationFixture({
      access: [],
    });
    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<Overview location={mockLocation} />, {organization: billingOrg});

    expect(await screen.findByTestId('usage-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('recurring-credits-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('spike-protection-details')).not.toBeInTheDocument();
    expect(screen.queryByTestId('permission-denied')).not.toBeInTheDocument();
  });

  it('renders ContactBillingMembers for members on managed accounts', async () => {
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

    render(<Overview location={mockLocation} />, {organization: billingOrg});

    expect(await screen.findByTestId('permission-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('usage-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recurring-credits-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('spike-protection-details')).not.toBeInTheDocument();
  });

  it('opens codecov modal', async () => {
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

  it('renders for am1 no product trial', async () => {
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

  it('renders breakdown for transactions only', async () => {
    // Set up AM2 subscription with profiling-billing feature
    const subscription = SubscriptionFixture({
      plan: 'am2_f',
      planTier: PlanTier.AM2,
      organization,
    });
    organization.features.push('profiling-billing');
    SubscriptionStore.set(organization.slug, subscription);

    // Set up mock data with event totals for transactions and profiles
    const mockApi = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/usage/`,
      method: 'GET',
      body: {
        ...CustomerUsageFixture(),
        eventTotals: {
          transactions: {
            accepted: 50000,
            dropped: 0,
            droppedOther: 0,
            droppedOverQuota: 0,
            droppedSpikeProtection: 0,
            filtered: 0,
            projected: 0,
          },
          profiles: {
            accepted: 25000,
            dropped: 0,
            droppedOther: 0,
            droppedOverQuota: 0,
            droppedSpikeProtection: 0,
            filtered: 0,
            projected: 0,
          },
          profileDuration: {
            accepted: 25000,
            dropped: 0,
            droppedOther: 0,
            droppedOverQuota: 0,
          },
        },
      },
    });

    render(<Overview location={mockLocation} />, {organization});

    expect(mockApi).toHaveBeenCalled();

    // Wait for the Performance units heading to be visible
    const performanceHeading = await screen.findByText(
      'Performance units usage this period'
    );
    expect(performanceHeading).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('expand-usage-totals-transactions'));

    const transactionsTable = screen.getByTestId('category-table-transactions');
    expect(transactionsTable).toBeInTheDocument();

    // event-table-accepted should be present means breakdown is shown
    const acceptedTable = screen.getByTestId('event-table-accepted');
    expect(acceptedTable).toBeInTheDocument();

    // hide transactions breakdown
    await userEvent.click(screen.getByTestId('expand-usage-totals-transactions'));
    expect(screen.queryByTestId('event-table-accepted')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('expand-usage-totals-profileDuration'));
    expect(screen.getByTestId('category-table-profileDuration')).toBeInTheDocument();

    // event breakdown is not shown for profileDuration
    expect(screen.queryByTestId('event-table-accepted')).not.toBeInTheDocument();
  });
});
