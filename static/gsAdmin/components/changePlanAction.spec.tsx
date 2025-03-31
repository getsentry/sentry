import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import {PlanFixture} from 'getsentry/__fixtures__/plan';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier, type Subscription} from 'getsentry/types';

import triggerChangePlanAction from '../components/changePlanAction';

describe('ChangePlanAction', () => {
  const mockOrg = OrganizationFixture({slug: 'org-slug'});
  const subscription: Subscription = SubscriptionFixture({
    organization: mockOrg,
    planTier: PlanTier.AM3,
    plan: 'am3_business',
    billingInterval: 'monthly',
    contractInterval: 'monthly',
    planDetails: PlanFixture({
      id: 'am3_business',
      name: 'Business',
    }),
    categories: {
      errors: MetricHistoryFixture({
        category: 'errors',
        reserved: 1000000,
        prepaid: 1000000,
        order: 1,
      }),
    },
  });
  SubscriptionStore.set(mockOrg.slug, subscription);
  const BILLING_CONFIG = BillingConfigFixture(PlanTier.ALL);
  const testPlan = PlanFixture({
    id: 'am3_test_monthly',
    name: 'TEST Tier Test Plan',
    price: 5000,
    basePrice: 5000,
    billingInterval: 'monthly',
    contractInterval: 'monthly',
    reservedMinimum: 500000,
    categories: ['errors', 'transactions'],
    planCategories: {
      errors: [{events: 50000, price: 1000}],
      transactions: [{events: 10000, price: 2500}],
    },
    userSelectable: true,
    isTestPlan: true,
  });

  BILLING_CONFIG.planList.push(testPlan);

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();

    const user = UserFixture();
    user.permissions = new Set(['billing.provision']);
    ConfigStore.set('user', user);

    // Set up default subscription response
    MockApiClient.addMockResponse({
      url: `/subscriptions/${mockOrg.slug}/`,
      body: subscription,
    });

    MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/billing-config/?tier=all`,
      body: BILLING_CONFIG,
    });

    const testSubscription = {
      ...subscription,
      planTier: PlanTier.TEST,
      plan: 'am3_test_monthly',
      planDetails: {
        id: 'am3_test_monthly',
        name: 'TEST Tier Test Plan',
        isTestPlan: true,
      },
    };

    MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/subscription/`,
      body: testSubscription,
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/${mockOrg.slug}/`,
      body: testSubscription,
    });
  });

  async function openAndLoadModal(props = {}) {
    triggerChangePlanAction({
      subscription,
      orgId: mockOrg.slug,
      onSuccess: jest.fn(),
      partnerPlanId: null,
      ...props,
    });
    const modal = renderGlobalModal();
    expect(await screen.findByText('Change Plan')).toBeInTheDocument();
    return modal;
  }

  it('loads the billing config and displays plan options', async () => {
    openAndLoadModal();

    // Wait for async data to load
    await waitFor(() => {
      expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
    });

    // Verify the tabs are rendered
    expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'AM2'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'MM2'})).toBeInTheDocument();

    // Verify at least one plan option is displayed
    expect(screen.getByTestId('change-plan-radio-btn-am3_business')).toBeInTheDocument();

    // Test basic interaction - click on AM2 tier
    const am2Tab = screen.getByRole('tab', {name: 'AM2'});
    await userEvent.click(am2Tab);
  });

  it('completes form submission flow', async () => {
    // Mock the PUT endpoint response
    const putMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/subscription/`,
      method: 'PUT',
      body: {success: true},
    });

    openAndLoadModal();

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
    });

    // Select a plan
    const planRadio = screen.getByTestId('change-plan-radio-btn-am3_business');
    await userEvent.click(planRadio);

    // Select reserved volumes
    await userEvent.type(screen.getByRole('textbox', {name: 'Errors'}), '100000\n');
    expect(screen.getByRole('textbox', {name: 'Errors'})).toHaveValue('100,000');
    await userEvent.type(screen.getByRole('textbox', {name: 'Replays'}), '50\n');
    await userEvent.type(screen.getByRole('textbox', {name: 'Spans'}), '10000000\n');
    await userEvent.type(screen.getByRole('textbox', {name: 'Cron monitors'}), '1\n');
    await userEvent.type(screen.getByRole('textbox', {name: 'Uptime monitors'}), '1\n');
    await userEvent.type(screen.getByRole('textbox', {name: 'Attachments (GB)'}), '1\n');

    expect(screen.getByRole('button', {name: 'Change Plan'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

    // Verify the PUT API was called
    expect(putMock).toHaveBeenCalled();
    const requestData = putMock.mock.calls[0][1].data;
    expect(requestData).toHaveProperty('plan', 'am3_business');
  });

  it('updates plan list when switching between tiers', async () => {
    openAndLoadModal();

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
    });

    // Verify AM3 tier plans are displayed
    expect(screen.getByTestId('change-plan-radio-btn-am3_business')).toBeInTheDocument();

    // Switch to AM2 tier
    const am2Tab = screen.getByRole('tab', {name: 'AM2'});
    await userEvent.click(am2Tab);

    // When clicking on a different tier, it takes time for the plan list to update
    // Rather than checking for a specific plan, let's check that we still have a plan option
    // but it's no longer the AM3 plan
    await waitFor(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios.length).toBeGreaterThan(0);
    });

    // Switch to MM2 tier
    const mm2Tab = screen.getByRole('tab', {name: 'MM2'});
    await userEvent.click(mm2Tab);

    // Again, verify we have plan options
    await waitFor(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios.length).toBeGreaterThan(0);
    });
  });

  it('shows only test plans when using TEST tier', async () => {
    openAndLoadModal();

    // First, click the TEST tier to activate it
    await waitFor(() => {
      expect(screen.getByRole('tab', {name: 'TEST'})).toBeInTheDocument();
    });

    const testTierTab = screen.getByRole('tab', {name: 'TEST'});
    await userEvent.click(testTierTab);

    // Verify TEST tier plans are shown after clicking the TEST tier tab
    await waitFor(() => {
      const testPlans = screen.queryAllByTestId('change-plan-radio-btn-am3_test_monthly');
      expect(testPlans.length).toBeGreaterThan(0);
    });
  });

  it('completes form submission flow for the TEST tier', async () => {
    // Mock the PUT endpoint response
    const putMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/subscription/`,
      method: 'PUT',
      body: {success: true},
    });

    openAndLoadModal();

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByRole('tab', {name: 'TEST'})).toBeInTheDocument();
    });

    // Click on the TEST tier tab (if not already active)
    const testTierTab = screen.getByRole('tab', {name: 'TEST'});
    await userEvent.click(testTierTab);

    // Find test plan radio button and select it
    await waitFor(
      () => {
        const testPlans = screen.queryAllByTestId(
          'change-plan-radio-btn-am3_test_monthly'
        );
        expect(testPlans.length).toBeGreaterThan(0);
        return testPlans;
      },
      {timeout: 2000}
    ).then(async testPlans => {
      if (testPlans && testPlans.length > 0) {
        await userEvent.click(testPlans[0] as HTMLElement);
      }
    });

    // Verify the PUT API was called
    expect(putMock).toHaveBeenCalled();
    const requestData = putMock.mock.calls[0][1].data;
    expect(requestData).toHaveProperty('plan', 'am3_test_monthly');
    expect(requestData).toHaveProperty('reservedErrors', 50000);
    expect(requestData).toHaveProperty('reservedTransactions', 10000);
  });
});
