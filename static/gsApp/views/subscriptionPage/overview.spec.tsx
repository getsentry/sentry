import {OrganizationFixture} from 'sentry-fixture/organization';

import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {RecurringCreditFixture} from 'getsentry-test/fixtures/recurringCredit';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

import {PendingChangesFixture} from 'getsentry/__fixtures__/pendingChanges';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
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

  describe('Pending Changes', () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'mm2_b_100k',
      pendingChanges: PendingChangesFixture({
        plan: 'mm2_a_100k',
        onDemandMaxSpend: 0,
        effectiveDate: '2021-09-01',
        onDemandEffectiveDate: '2021-09-01',
        planDetails: PlanDetailsLookupFixture('mm2_a_100k'),
      }),
    });

    it('renders pending changes', async () => {
      SubscriptionStore.set(organization.slug, subscription);
      render(<Overview />, {
        organization,
        additionalWrapper: SecondaryNavigationContextProvider,
      });

      expect(
        await screen.findByText(/The following changes will take effect on/)
      ).toBeInTheDocument();
    });
  });

  describe('Recurring Credits', () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'mm2_b_100k',
    });

    it('renders empty', async () => {
      SubscriptionStore.set(organization.slug, subscription);
      render(<Overview />, {
        organization,
        additionalWrapper: SecondaryNavigationContextProvider,
      });

      expect(await screen.findByText(/Usage:/)).toBeInTheDocument();
      expect(screen.queryByTestId('recurring-credits-panel')).not.toBeInTheDocument();
    });

    it('renders recurring credits', async () => {
      SubscriptionStore.set(organization.slug, subscription);
      const mockApi = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/recurring-credits/`,
        method: 'GET',
        body: [RecurringCreditFixture()],
      });

      render(<Overview />, {
        organization,
        additionalWrapper: SecondaryNavigationContextProvider,
      });

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
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/recurring-credits/`,
      method: 'GET',
      body: [RecurringCreditFixture()],
    });

    render(<Overview />, {
      organization: billingOrg,
      additionalWrapper: SecondaryNavigationContextProvider,
    });

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
      organization: billingOrg,
      canSelfServe: false,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<Overview />, {
      organization: billingOrg,
      additionalWrapper: SecondaryNavigationContextProvider,
    });

    expect(await screen.findByTestId('permission-denied')).toBeInTheDocument();
    expect(screen.queryByText(/Usage:/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('recurring-credits-panel')).not.toBeInTheDocument();
  });
});
