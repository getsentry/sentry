import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {
  SubscriptionFixture,
  SubscriptionWithLegacySeerFixture,
} from 'getsentry-test/fixtures/subscription';
import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {ConfigStore} from 'sentry/stores/configStore';
import {DataCategory} from 'sentry/types/core';

import {triggerChangePlanAction} from 'admin/components/changePlanAction';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';

describe('ChangePlanAction', () => {
  const mockOrg = OrganizationFixture({slug: 'org-slug'});
  const subscription = SubscriptionFixture({
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

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();

    const user = UserFixture();
    user.permissions = new Set(['billing.provision']);
    ConfigStore.set('user', user);
    SubscriptionStore.set(mockOrg.slug, subscription);

    // Set up default subscription response
    MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/`,
      body: subscription,
    });

    MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/billing-config/`,
      body: BILLING_CONFIG,
      match: [MockApiClient.matchQuery({tier: 'all'})],
    });
  });

  async function openAndLoadModal(props = {}) {
    triggerChangePlanAction({
      subscription,
      organization: mockOrg,
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

    // All tiers' plans load into a single list (no tabbed interface)
    expect(
      await screen.findByTestId('change-plan-label-am3_business')
    ).toBeInTheDocument();
    expect(screen.getByTestId('change-plan-label-am2_business')).toBeInTheDocument();

    // Selecting an AM3 plan shows its checkout categories (spans, not transactions)
    await userEvent.click(screen.getByRole('radio', {name: /am3_business\b/}));
    expect(screen.getByRole('textbox', {name: 'Spans'})).toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Transactions'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'Performance units'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'Continuous profile hours'})
    ).not.toBeInTheDocument();

    // Selecting an AM2 plan swaps to its categories (performance units, not spans)
    await userEvent.click(screen.getByRole('radio', {name: /am2_business\b/}));
    expect(screen.getByRole('textbox', {name: 'Performance units'})).toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Spans'})).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Transactions'})).not.toBeInTheDocument();
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
      url: `/customers/${mockOrg.slug}/`,
      body: ntSubscription,
    });

    await openAndLoadModal({partnerPlanId: ntSubscription.plan});

    // Partner plans aren't modifiable, so only the existing plan is shown
    expect(
      await screen.findByTestId('change-plan-label-am2_business')
    ).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(1);
  });

  it('completes form submission flow', async () => {
    mockOrg.features = [];
    // Mock the PUT endpoint response
    const putMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/subscription/`,
      method: 'PUT',
      body: {success: true},
    });

    openAndLoadModal();

    // Select an AM3 plan from the flat list
    await userEvent.click(await screen.findByRole('radio', {name: /am3_business\b/}));

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
    await selectEvent.select(screen.getByRole('textbox', {name: 'Logs (GB)'}), '5');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Size analysis builds'}),
      '100'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Build distribution installs'}),
      '-1'
    );

    expect(screen.getByText('Available Products')).toBeInTheDocument(); // will always show if any product is launched and available for an org

    expect(screen.getByRole('button', {name: 'Change Plan'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

    // Verify the PUT API was called
    expect(putMock).toHaveBeenCalled();
    const requestData = putMock.mock.calls[0][1].data;
    expect(requestData).toHaveProperty('plan', 'am3_business');
  });

  it('completes form with addOns', async () => {
    const putMock = MockApiClient.addMockResponse({
      url: `/customers/${mockOrg.slug}/subscription/`,
      method: 'PUT',
      body: {success: true},
    });

    openAndLoadModal();

    await userEvent.click(await screen.findByRole('radio', {name: /am3_business\b/}));

    await selectEvent.select(screen.getByRole('textbox', {name: 'Errors'}), '100,000');
    await selectEvent.select(screen.getByRole('textbox', {name: 'Replays'}), '50');
    await selectEvent.select(screen.getByRole('textbox', {name: 'Spans'}), '10,000,000');
    await selectEvent.select(screen.getByRole('textbox', {name: 'Cron monitors'}), '1');
    await selectEvent.select(screen.getByRole('textbox', {name: 'Uptime monitors'}), '1');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Attachments (GB)'}),
      '1'
    );
    await selectEvent.select(screen.getByRole('textbox', {name: 'Logs (GB)'}), '5');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Size analysis builds'}),
      '100'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Build distribution installs'}),
      '-1'
    );

    // XXX: irl we would not have both versions of Seer available, but doing this for testing multiple addons
    expect(screen.getByText('Available Products')).toBeInTheDocument();
    const seerSelection = screen.getByText('Seer');
    const legacySeerSelection = screen.getByText('Seer (Legacy)');
    expect(seerSelection).toBeInTheDocument();
    expect(legacySeerSelection).toBeInTheDocument();
    await userEvent.click(seerSelection);
    await userEvent.click(legacySeerSelection);

    expect(screen.getByRole('button', {name: 'Change Plan'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

    expect(putMock).toHaveBeenCalled();
    const requestData = putMock.mock.calls[0][1].data;
    expect(requestData).toHaveProperty('plan', 'am3_business');
    expect(requestData).toHaveProperty('addOnLegacySeer', true);
    expect(requestData).toHaveProperty('addOnSeer', true);
  });

  describe('Legacy Seer', () => {
    beforeEach(() => {
      mockOrg.features = ['seer-billing'];
      jest.clearAllMocks();
      MockApiClient.clearMockResponses();

      const user = UserFixture();
      user.permissions = new Set(['billing.provision']);
      ConfigStore.set('user', user);
      SubscriptionStore.set(mockOrg.slug, subscription);

      // Set up default subscription response
      MockApiClient.addMockResponse({
        url: `/customers/${mockOrg.slug}/`,
        body: subscription,
      });

      MockApiClient.addMockResponse({
        url: `/customers/${mockOrg.slug}/billing-config/`,
        body: BILLING_CONFIG,
        match: [MockApiClient.matchQuery({tier: 'all'})],
      });
    });

    it('shows Seer budget checkbox for AM tiers', async () => {
      openAndLoadModal();

      await userEvent.click(await screen.findByRole('radio', {name: /am3_business\b/}));
      expect(screen.getByText('Seer')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', {name: /am2_business\b/}));
      expect(screen.getByText('Seer')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', {name: /am1_business\b/}));
      expect(screen.getByText('Seer')).toBeInTheDocument();
    });

    it('initializes Seer budget checkbox based on current subscription', async () => {
      // Create subscription with Seer budget
      const subscriptionWithSeer = SubscriptionWithLegacySeerFixture({
        organization: mockOrg,
        planTier: PlanTier.AM3,
        plan: 'am3_business',
      });

      SubscriptionStore.set(mockOrg.slug, subscriptionWithSeer);
      MockApiClient.addMockResponse({
        url: `/customers/${mockOrg.slug}/`,
        body: subscriptionWithSeer,
      });

      await openAndLoadModal({subscription: subscriptionWithSeer});

      // Select a plan to make the Available Products section visible
      await userEvent.click(await screen.findByRole('radio', {name: /am3_business\b/}));

      // Verify Seer budget checkbox is checked when subscription has Seer budget
      const seerCheckbox = screen.getByRole('checkbox', {
        name: 'Seer (Legacy)',
      });
      expect(seerCheckbox).toBeChecked();
    });

    it('initializes Seer budget checkbox as unchecked when subscription has no Seer budget', async () => {
      openAndLoadModal({});

      // Select a plan to make the Available Products section visible
      await userEvent.click(await screen.findByRole('radio', {name: /am3_business\b/}));

      // Verify Seer budget checkbox is unchecked when subscription has no Seer budget
      const seerCheckbox = screen.getByRole('checkbox', {
        name: 'Seer',
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

      // Select a plan
      await userEvent.click(await screen.findByRole('radio', {name: /am3_business\b/}));

      // Check the Seer budget checkbox
      const seerCheckbox = screen.getByRole('checkbox', {
        name: 'Seer (Legacy)',
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
      await selectEvent.select(screen.getByRole('textbox', {name: 'Logs (GB)'}), '5');
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Size analysis builds'}),
        '100'
      );
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Build distribution installs'}),
        '-1'
      );

      // Submit the form
      expect(screen.getByRole('button', {name: 'Change Plan'})).toBeEnabled();
      await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

      // Verify the PUT API was called with seer parameter
      expect(putMock).toHaveBeenCalled();
      const requestData = putMock.mock.calls[0][1].data;
      expect(requestData).toHaveProperty('addOnLegacySeer', true);
    });

    it('does not include add-on parameter in form submission when checkbox is unchecked', async () => {
      // Mock the PUT endpoint response
      const putMock = MockApiClient.addMockResponse({
        url: `/customers/${mockOrg.slug}/subscription/`,
        method: 'PUT',
        body: {success: true},
      });

      openAndLoadModal({});

      // Select a plan
      await userEvent.click(await screen.findByRole('radio', {name: /am3_business\b/}));

      // Verify Seer budget checkbox is unchecked (default state)
      const seerCheckbox = screen.getByRole('checkbox', {
        name: 'Seer (Legacy)',
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
      await selectEvent.select(screen.getByRole('textbox', {name: 'Logs (GB)'}), '5');
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Size analysis builds'}),
        '100'
      );
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Build distribution installs'}),
        '-1'
      );

      // Submit the form
      expect(screen.getByRole('button', {name: 'Change Plan'})).toBeEnabled();
      await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

      // Verify the PUT API was called with seer parameter set to false
      expect(putMock).toHaveBeenCalled();
      const requestData = putMock.mock.calls[0][1].data;
      expect(requestData).toHaveProperty('addOnLegacySeer', false);
    });
  });
});
