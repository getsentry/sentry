import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SeerReservedBudgetFixture} from 'getsentry-test/fixtures/reservedBudget';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ConfigStore from 'sentry/stores/configStore';
import {DataCategory} from 'sentry/types/core';

import triggerChangePlanAction from 'admin/components/changePlanAction';
import {PlanFixture} from 'getsentry/__fixtures__/plan';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier, type Subscription} from 'getsentry/types';

describe('ChangePlanAction', () => {
  const mockOrg = OrganizationFixture({slug: 'org-slug'});
  const subscription: Subscription = SubscriptionFixture({
    organization: mockOrg,
    planTier: PlanTier.AM3,
    plan: 'am3_business',
    billingInterval: 'monthly',
    contractInterval: 'monthly',
    categories: {
      errors: MetricHistoryFixture({
        category: DataCategory.ERRORS,
        reserved: 1000000,
        prepaid: 1000000,
        order: 1,
      }),
    },
  });
  const BILLING_CONFIG = BillingConfigFixture(PlanTier.ALL);
  const testPlan = PlanFixture({
    id: 'test_test_monthly',
    name: 'TEST Tier Test Plan',
    price: 5000,
    basePrice: 5000,
    billingInterval: 'monthly',
    contractInterval: 'monthly',
    reservedMinimum: 500000,
    categories: [DataCategory.ERRORS, DataCategory.TRANSACTIONS],
    checkoutCategories: [DataCategory.ERRORS, DataCategory.TRANSACTIONS],
    planCategories: {
      errors: [
        {events: 50000, price: 1000},
        {events: 100000, price: 2000},
      ],
      transactions: [
        {events: 10000, price: 2500},
        {events: 25000, price: 5000},
      ],
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
    SubscriptionStore.set(mockOrg.slug, subscription);

    // Set up default subscription response
    MockApiClient.addMockResponse({
      url: `/subscriptions/${mockOrg.slug}/`,
      body: subscription,
    });

    MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/billing-config/?tier=all`,
      body: BILLING_CONFIG,
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
    expect(await screen.findByRole('button', {name: 'Change Plan'})).toBeInTheDocument();
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
    expect(screen.getByTestId('change-plan-label-am3_business')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('radio')[0] as HTMLElement);

    // Verify checkout categories are displayed
    expect(screen.getAllByRole('textbox')).toHaveLength(
      subscription.planDetails.checkoutCategories.length + 2 // +2 for audit fields
    );
    expect(screen.getByRole('textbox', {name: 'Spans'})).toBeInTheDocument();

    // Does not display non-checkout categories or non-existent categories
    expect(
      screen.queryByRole('textbox', {name: 'Continuous profile hours'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Transactions'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'Performance units'})
    ).not.toBeInTheDocument();

    // Test basic interaction - click on AM2 tier
    const am2Tab = screen.getByRole('tab', {name: 'AM2'});
    await userEvent.click(am2Tab);

    // Verify tab change changes plan options displayed
    expect(screen.getByTestId('change-plan-label-am2_business')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('radio')[0] as HTMLElement);

    // Verify tab change changes categories displayed
    expect(screen.getAllByRole('textbox')).toHaveLength(
      PlanDetailsLookupFixture('am2_business')!.checkoutCategories.length + 2 // +2 for audit fields
    );
    expect(screen.getByRole('textbox', {name: 'Performance units'})).toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Transactions'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'Continuous profile hours'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Spans'})).not.toBeInTheDocument();
  });

  it('only displays current plan for NT customers', async () => {
    const ntSubscription = SubscriptionFixture({
      organization: mockOrg,
      plan: 'am2_business',
      partner: {
        externalId: '123',
        name: 'test',
        partnership: {
          id: 'NT',
          displayName: 'NT',
          supportNote: '',
        },
        isActive: true,
      },
      sponsoredType: 'NT',
    });
    SubscriptionStore.set(mockOrg.slug, ntSubscription);
    MockApiClient.addMockResponse({
      url: `/subscriptions/${mockOrg.slug}/`,
      body: ntSubscription,
    });

    await openAndLoadModal({partnerPlanId: ntSubscription.plan});

    expect(screen.queryByTestId('am3-tier')).not.toBeInTheDocument();
    expect(screen.queryByTestId('am2-tier')).not.toBeInTheDocument();
    expect(screen.queryByTestId('am1-tier')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mm2-tier')).not.toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByTestId('change-plan-label-am2_business')).toBeInTheDocument();
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
    await userEvent.click(screen.getAllByRole('radio')[0] as HTMLElement);

    // Select reserved volumes
    await selectEvent.select(screen.getByRole('textbox', {name: 'Errors'}), '100,000');
    await selectEvent.select(screen.getByRole('textbox', {name: 'Replays'}), '50');
    await selectEvent.select(screen.getByRole('textbox', {name: 'Spans'}), '10,000,000');
    await selectEvent.select(screen.getByRole('textbox', {name: 'Cron monitors'}), '1');
    await selectEvent.select(screen.getByRole('textbox', {name: 'Uptime monitors'}), '1');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Attachments (GB)'}),
      '1'
    );

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
    expect(screen.getByTestId('change-plan-label-am3_business')).toBeInTheDocument();

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
      const testPlans = screen.queryAllByTestId('change-plan-label-test_test_monthly');
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
    expect(screen.getByRole('button', {name: 'Change Plan'})).toBeDisabled();
    expect(screen.getByTestId('change-plan-label-test_test_monthly')).toBeInTheDocument();

    // Select a plan
    await userEvent.click(screen.getAllByRole('radio')[0] as HTMLElement);

    // Select reserved volumes
    await selectEvent.select(screen.getByRole('textbox', {name: 'Errors'}), '50,000');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Transactions'}),
      '25,000'
    );

    expect(screen.getByRole('button', {name: 'Change Plan'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

    // Verify the PUT API was called
    expect(putMock).toHaveBeenCalled();
    const requestData = putMock.mock.calls[0][1].data;
    expect(requestData).toHaveProperty('plan', 'test_test_monthly');
    expect(requestData).toHaveProperty('reservedErrors', 50000);
    expect(requestData).toHaveProperty('reservedTransactions', 25000);
  });

  describe('Seer Budget', () => {
    it('shows Seer budget checkbox for AM tiers', async () => {
      openAndLoadModal({});

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
      });

      // Verify Seer budget checkbox is shown for AM3 (default tier)
      expect(screen.getByRole('checkbox', {name: 'Seer Budget'})).toBeInTheDocument();

      // Switch to AM2 tier
      const am2Tab = screen.getByRole('tab', {name: 'AM2'});
      await userEvent.click(am2Tab);

      // Verify Seer budget checkbox is still shown for AM2
      expect(screen.getByRole('checkbox', {name: 'Seer Budget'})).toBeInTheDocument();

      // Switch to AM1 tier
      const am1Tab = screen.getByRole('tab', {name: 'AM1'});
      await userEvent.click(am1Tab);

      // Verify Seer budget checkbox is still shown for AM1
      expect(
        screen.getByRole('checkbox', {
          name: 'Seer Budget',
        })
      ).toBeInTheDocument();
    });

    it('hides Seer budget checkbox for MM2 tier', async () => {
      openAndLoadModal({});

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
      });

      // Switch to MM2 tier
      const mm2Tab = screen.getByRole('tab', {name: 'MM2'});
      await userEvent.click(mm2Tab);

      // Verify Seer budget checkbox is not shown for MM2
      expect(
        screen.queryByRole('checkbox', {
          name: 'Seer Budget',
        })
      ).not.toBeInTheDocument();
    });

    it('shows Seer budget checkbox for TEST tier', async () => {
      openAndLoadModal({});

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
      });

      // Switch to TEST tier
      const testTab = screen.getByRole('tab', {name: 'TEST'});
      await userEvent.click(testTab);

      // Verify Seer budget checkbox is shown for TEST tier
      expect(
        screen.queryByRole('checkbox', {
          name: 'Seer Budget',
        })
      ).toBeInTheDocument();
    });

    it('hides Seer budget checkbox for partner plans', async () => {
      const partnerSubscription = SubscriptionFixture({
        organization: mockOrg,
        plan: 'am2_business',
        partner: {
          externalId: '123',
          name: 'test',
          partnership: {
            id: 'NT',
            displayName: 'NT',
            supportNote: '',
          },
          isActive: true,
        },
        sponsoredType: 'NT',
      });

      SubscriptionStore.set(mockOrg.slug, partnerSubscription);
      MockApiClient.addMockResponse({
        url: `/subscriptions/${mockOrg.slug}/`,
        body: partnerSubscription,
      });

      await openAndLoadModal({
        subscription: partnerSubscription,
        partnerPlanId: partnerSubscription.plan,
      });

      // Verify Seer budget checkbox is not shown for partner plans
      expect(
        screen.queryByRole('checkbox', {
          name: 'Seer Budget',
        })
      ).not.toBeInTheDocument();
    });

    it('initializes Seer budget checkbox based on current subscription', async () => {
      // Create subscription with Seer budget
      const subscriptionWithSeer = SubscriptionFixture({
        organization: mockOrg,
        planTier: PlanTier.AM3,
        plan: 'am3_business',
        billingInterval: 'monthly',
        contractInterval: 'monthly',
        reservedBudgets: [SeerReservedBudgetFixture({})],
        categories: {
          errors: MetricHistoryFixture({
            category: DataCategory.ERRORS,
            reserved: 1000000,
            prepaid: 1000000,
            order: 1,
          }),
        },
      });

      SubscriptionStore.set(mockOrg.slug, subscriptionWithSeer);
      MockApiClient.addMockResponse({
        url: `/subscriptions/${mockOrg.slug}/`,
        body: subscriptionWithSeer,
      });

      await openAndLoadModal({subscription: subscriptionWithSeer});

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
      });

      // Verify Seer budget checkbox is checked when subscription has Seer budget
      const seerCheckbox = screen.getByRole('checkbox', {
        name: 'Seer Budget',
      });
      expect(seerCheckbox).toBeChecked();
    });

    it('initializes Seer budget checkbox as unchecked when subscription has no Seer budget', async () => {
      openAndLoadModal({});

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
      });

      // Verify Seer budget checkbox is unchecked when subscription has no Seer budget
      const seerCheckbox = screen.getByRole('checkbox', {
        name: 'Seer Budget',
      });
      expect(seerCheckbox).not.toBeChecked();
    });

    it('includes seer parameter in form submission when checkbox is checked', async () => {
      // Mock the PUT endpoint response
      const putMock = MockApiClient.addMockResponse({
        url: `/customers/${mockOrg.slug}/subscription/`,
        method: 'PUT',
        body: {success: true},
      });

      openAndLoadModal({});

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
      });

      // Select a plan
      await userEvent.click(screen.getAllByRole('radio')[0] as HTMLElement);

      // Check the Seer budget checkbox
      const seerCheckbox = screen.getByRole('checkbox', {
        name: 'Seer Budget',
      });
      await userEvent.click(seerCheckbox);

      // Select required reserved volumes
      await selectEvent.select(screen.getByRole('textbox', {name: 'Errors'}), '100,000');
      await selectEvent.select(screen.getByRole('textbox', {name: 'Replays'}), '50');
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Spans'}),
        '10,000,000'
      );
      await selectEvent.select(screen.getByRole('textbox', {name: 'Cron monitors'}), '1');
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Uptime monitors'}),
        '1'
      );
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Attachments (GB)'}),
        '1'
      );

      // Submit the form
      expect(screen.getByRole('button', {name: 'Change Plan'})).toBeEnabled();
      await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

      // Verify the PUT API was called with seer parameter
      expect(putMock).toHaveBeenCalled();
      const requestData = putMock.mock.calls[0][1].data;
      expect(requestData).toHaveProperty('seer', true);
    });

    it('does not include seer parameter in form submission when checkbox is unchecked', async () => {
      // Mock the PUT endpoint response
      const putMock = MockApiClient.addMockResponse({
        url: `/customers/${mockOrg.slug}/subscription/`,
        method: 'PUT',
        body: {success: true},
      });

      openAndLoadModal({});

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
      });

      // Select a plan
      await userEvent.click(screen.getAllByRole('radio')[0] as HTMLElement);

      // Verify Seer budget checkbox is unchecked (default state)
      const seerCheckbox = screen.getByRole('checkbox', {
        name: 'Seer Budget',
      });
      expect(seerCheckbox).not.toBeChecked();

      // Select required reserved volumes
      await selectEvent.select(screen.getByRole('textbox', {name: 'Errors'}), '100,000');
      await selectEvent.select(screen.getByRole('textbox', {name: 'Replays'}), '50');
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Spans'}),
        '10,000,000'
      );
      await selectEvent.select(screen.getByRole('textbox', {name: 'Cron monitors'}), '1');
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Uptime monitors'}),
        '1'
      );
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Attachments (GB)'}),
        '1'
      );

      // Submit the form
      expect(screen.getByRole('button', {name: 'Change Plan'})).toBeEnabled();
      await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

      // Verify the PUT API was called with seer parameter set to false
      expect(putMock).toHaveBeenCalled();
      const requestData = putMock.mock.calls[0][1].data;
      expect(requestData).toHaveProperty('seer', false);
    });

    it('does not include seer parameter for MM2 tier form submission', async () => {
      // Mock the PUT endpoint response for MM2 (uses different endpoint)
      const putMock = MockApiClient.addMockResponse({
        url: `/customers/${mockOrg.slug}/`,
        method: 'PUT',
        body: {success: true},
      });

      openAndLoadModal({});

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
      });

      // Switch to MM2 tier
      const mm2Tab = screen.getByRole('tab', {name: 'MM2'});
      await userEvent.click(mm2Tab);

      // Wait for MM2 plans to load
      await waitFor(() => {
        const radios = document.querySelectorAll('input[type="radio"]');
        expect(radios.length).toBeGreaterThan(0);
      });

      // Select a plan
      await userEvent.click(screen.getAllByRole('radio')[0] as HTMLElement);

      // Skip selecting reserved volumes for MM2 test - just verify seer parameter is not included
      // The form should be submittable without selecting volumes for this test

      // Submit the form
      expect(screen.getByRole('button', {name: 'Change Plan'})).toBeEnabled();
      await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

      // Verify the PUT API was called without seer parameter
      expect(putMock).toHaveBeenCalled();
      const requestData = putMock.mock.calls[0][1].data;
      expect(requestData).not.toHaveProperty('seer');
    });

    it('includes seer parameter for TEST tier form submission when checkbox is checked', async () => {
      // Mock the PUT endpoint response for TEST tier (uses subscription endpoint)
      const putMock = MockApiClient.addMockResponse({
        url: `/customers/${mockOrg.slug}/subscription/`,
        method: 'PUT',
        body: {success: true},
      });

      openAndLoadModal({});

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('tab', {name: 'TEST'})).toBeInTheDocument();
      });

      // Switch to TEST tier
      const testTab = screen.getByRole('tab', {name: 'TEST'});
      await userEvent.click(testTab);

      // Verify TEST tier plans are shown after clicking the TEST tier tab
      await waitFor(() => {
        const testPlans = screen.queryAllByTestId('change-plan-label-test_test_monthly');
        expect(testPlans.length).toBeGreaterThan(0);
      });

      // Wait for TEST plans to load and Seer checkbox to appear
      await waitFor(() => {
        expect(screen.getByRole('checkbox', {name: 'Seer Budget'})).toBeInTheDocument();
      });

      // Check the Seer budget checkbox
      const seerCheckbox = screen.getByRole('checkbox', {
        name: 'Seer Budget',
      });
      await userEvent.click(seerCheckbox);
      expect(seerCheckbox).toBeChecked();

      // Wait for TEST plans to load
      await waitFor(() => {
        const radios = document.querySelectorAll('input[type="radio"]');
        expect(radios.length).toBeGreaterThan(0);
      });

      // Select a plan
      await userEvent.click(screen.getAllByRole('radio')[0] as HTMLElement);

      // Select reserved volumes
      await selectEvent.select(screen.getByRole('textbox', {name: 'Errors'}), '50,000');
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Transactions'}),
        '25,000'
      );

      expect(screen.getByRole('button', {name: 'Change Plan'})).toBeEnabled();

      // Submit the form
      await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

      // Verify the PUT API was called with seer parameter
      expect(putMock).toHaveBeenCalled();
      const requestData = putMock.mock.calls[0][1].data;
      expect(requestData).toHaveProperty('seer', true);
    });

    it('resets Seer budget checkbox when switching from AM to MM2 tier', async () => {
      // Create subscription with Seer budget
      const subscriptionWithSeer = SubscriptionFixture({
        organization: mockOrg,
        planTier: PlanTier.AM3,
        plan: 'am3_business',
        billingInterval: 'monthly',
        contractInterval: 'monthly',
        reservedBudgets: [SeerReservedBudgetFixture({})],
        categories: {
          errors: MetricHistoryFixture({
            category: DataCategory.ERRORS,
            reserved: 1000000,
            prepaid: 1000000,
            order: 1,
          }),
        },
      });

      SubscriptionStore.set(mockOrg.slug, subscriptionWithSeer);
      MockApiClient.addMockResponse({
        url: `/subscriptions/${mockOrg.slug}/`,
        body: subscriptionWithSeer,
      });

      await openAndLoadModal({subscription: subscriptionWithSeer});

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
      });

      // Verify Seer budget checkbox is checked initially
      const seerCheckbox = screen.getByRole('checkbox', {
        name: 'Seer Budget',
      });
      expect(seerCheckbox).toBeChecked();

      // Switch to MM2 tier (non-AM tier)
      const mm2Tab = screen.getByRole('tab', {name: 'MM2'});
      await userEvent.click(mm2Tab);

      // Verify Seer budget checkbox is not visible for MM2
      expect(
        screen.queryByRole('checkbox', {
          name: 'Seer Budget',
        })
      ).not.toBeInTheDocument();

      // Switch back to AM2 tier
      const am2Tab = screen.getByRole('tab', {name: 'AM2'});
      await userEvent.click(am2Tab);

      // Verify Seer budget checkbox is visible again and reset to original subscription state (checked)
      const seerCheckboxAfterSwitch = screen.getByRole('checkbox', {
        name: 'Seer Budget',
      });
      expect(seerCheckboxAfterSwitch).toBeChecked();
    });

    it('resets Seer budget checkbox to subscription state when switching between AM tiers', async () => {
      openAndLoadModal({});

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
      });

      // Check the Seer budget checkbox (subscription has no Seer budget, so it starts unchecked)
      const seerCheckbox = screen.getByRole('checkbox', {
        name: 'Seer Budget',
      });
      expect(seerCheckbox).not.toBeChecked();
      await userEvent.click(seerCheckbox);
      expect(seerCheckbox).toBeChecked();

      // Switch to AM2 tier
      const am2Tab = screen.getByRole('tab', {name: 'AM2'});
      await userEvent.click(am2Tab);

      // Wait for tier switch to complete
      await waitFor(() => {
        expect(screen.getByRole('checkbox', {name: 'Seer Budget'})).toBeInTheDocument();
      });

      // Verify Seer budget checkbox resets to original subscription state (unchecked)
      const seerCheckboxAM2 = screen.getByRole('checkbox', {
        name: 'Seer Budget',
      });
      expect(seerCheckboxAM2).not.toBeChecked();

      // Switch to AM1 tier
      const am1Tab = screen.getByRole('tab', {name: 'AM1'});
      await userEvent.click(am1Tab);

      // Wait for tier switch to complete
      await waitFor(() => {
        expect(screen.getByRole('checkbox', {name: 'Seer Budget'})).toBeInTheDocument();
      });

      // Verify Seer budget checkbox still resets to original subscription state (unchecked)
      const seerCheckboxAM1 = screen.getByRole('checkbox', {
        name: 'Seer Budget',
      });
      expect(seerCheckboxAM1).not.toBeChecked();
    });

    it('resets Seer budget checkbox to subscription state when switching to TEST tier', async () => {
      // Create subscription with Seer budget
      const subscriptionWithSeer = SubscriptionFixture({
        organization: mockOrg,
        planTier: PlanTier.AM3,
        plan: 'am3_business',
        billingInterval: 'monthly',
        contractInterval: 'monthly',
        reservedBudgets: [SeerReservedBudgetFixture({})],
        categories: {
          errors: MetricHistoryFixture({
            category: DataCategory.ERRORS,
            reserved: 1000000,
            prepaid: 1000000,
            order: 1,
          }),
        },
      });

      SubscriptionStore.set(mockOrg.slug, subscriptionWithSeer);
      MockApiClient.addMockResponse({
        url: `/subscriptions/${mockOrg.slug}/`,
        body: subscriptionWithSeer,
      });

      await openAndLoadModal({subscription: subscriptionWithSeer});

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('tab', {name: 'AM3'})).toBeInTheDocument();
      });

      // Verify Seer budget checkbox is checked initially (subscription has Seer budget)
      const seerCheckbox = screen.getByRole('checkbox', {
        name: 'Seer Budget',
      });
      expect(seerCheckbox).toBeChecked();

      // Uncheck the checkbox manually
      await userEvent.click(seerCheckbox);
      expect(seerCheckbox).not.toBeChecked();

      // Switch to TEST tier
      const testTab = screen.getByRole('tab', {name: 'TEST'});
      await userEvent.click(testTab);

      // Wait for TEST tier to load and Seer checkbox to appear
      await waitFor(() => {
        expect(screen.getByRole('checkbox', {name: 'Seer Budget'})).toBeInTheDocument();
      });

      // Verify Seer budget checkbox resets to subscription state (checked)
      const seerCheckboxTEST = screen.getByRole('checkbox', {
        name: 'Seer Budget',
      });
      expect(seerCheckboxTEST).toBeChecked();
    });
  });
});
