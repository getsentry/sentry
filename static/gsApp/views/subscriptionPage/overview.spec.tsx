import {OrganizationFixture} from 'sentry-fixture/organization';

import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {PlanMigrationFixture} from 'getsentry-test/fixtures/planMigration';
import {RecurringCreditFixture} from 'getsentry-test/fixtures/recurringCredit';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {PendingChangesFixture} from 'getsentry/__fixtures__/pendingChanges';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {CohortId, PlanTier} from 'getsentry/types';
import Overview from 'getsentry/views/subscriptionPage/overview';

describe('Subscription > Overview', () => {
  const organization = OrganizationFixture({access: ['org:billing']});

  beforeEach(() => {
    organization.features = [];
    MockApiClient.clearMockResponses();
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
      render(<Overview />, {organization});

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

      render(<Overview />, {organization});

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

      render(<Overview />, {organization});

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
      render(<Overview />, {organization});

      expect(await screen.findByText('Subscription')).toBeInTheDocument();
      expect(screen.queryByTestId('recurring-credits-panel')).not.toBeInTheDocument();
    });

    it('renders recurring credits', async () => {
      SubscriptionStore.set(organization.slug, subscription);
      const mockApi = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/recurring-credits/`,
        method: 'GET',
        body: [RecurringCreditFixture()],
      });

      render(<Overview />, {organization});

      expect(await screen.findByTestId('recurring-credits-panel')).toBeInTheDocument();

      expect(mockApi).toHaveBeenCalledTimes(1);
    });
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
    MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/recurring-credits/`,
      method: 'GET',
      body: [RecurringCreditFixture()],
    });

    render(<Overview />, {organization: billingOrg});

    expect(await screen.findByText(/Usage:/)).toBeInTheDocument(); // title of usage overview table
    expect(screen.queryByTestId('recurring-credits-panel')).not.toBeInTheDocument();
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

    render(<Overview />, {organization: billingOrg});

    expect(await screen.findByTestId('permission-denied')).toBeInTheDocument();
    expect(screen.queryByText(/Usage:/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('recurring-credits-panel')).not.toBeInTheDocument();
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

    render(<Overview />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/billing/overview/`,
          query: {open_codecov_modal: '1'},
        },
      },
    });
    renderGlobalModal();

    expect(await screen.findByText('Try Code Coverage')).toBeInTheDocument();
  });
});
