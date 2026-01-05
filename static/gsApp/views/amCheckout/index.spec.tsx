import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {AddOnCategory, OnDemandBudgetMode, PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout';
import {getCheckoutAPIData} from 'getsentry/views/amCheckout/utils';
import {hasOnDemandBudgetsFeature} from 'getsentry/views/onDemandBudgets/utils';

function assertCheckoutSteps({
  tier,
  hasBillingCycleStep = true,
  hasBillingInfoStep = true,
}: {
  tier: PlanTier;
  hasBillingCycleStep?: boolean;
  hasBillingInfoStep?: boolean;
}) {
  expect(screen.getByTestId('checkout-steps')).toBeInTheDocument();
  [
    'Select a plan',
    [PlanTier.AM1, PlanTier.AM2].includes(tier)
      ? /Set your on-demand limit/
      : /Set your pay-as-you-go limit/,
    'Pay monthly or yearly, your choice',
    'Edit billing information',
  ]
    .filter(
      step =>
        (hasBillingCycleStep || step !== 'Pay monthly or yearly, your choice') &&
        (hasBillingInfoStep || step !== 'Edit billing information')
    )
    .forEach(step => {
      expect(screen.getByText(step)).toBeInTheDocument();
    });
}
describe('Legacy Tier Checkout', () => {
  let mockResponse: any;

  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});

  beforeEach(() => {
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    mockResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM2),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
    });
  });

  it('renders for AM2', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        checkoutTier={PlanTier.AM2}
        navigate={jest.fn()}
        api={api}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am2'},
        })
      );
    });

    assertCheckoutSteps({tier: PlanTier.AM2});
  });

  it('renders for AM1', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        checkoutTier={PlanTier.AM1}
        navigate={jest.fn()}
        api={api}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am1'},
        })
      );
    });

    assertCheckoutSteps({tier: PlanTier.AM1});
  });

  it('renders standard checkout for business bundle', async () => {
    const am2BizSubscription = SubscriptionFixture({
      organization,
      plan: 'am2_business_bundle',
      planTier: 'am2',
      categories: {
        errors: MetricHistoryFixture({reserved: 100_000}),
        transactions: MetricHistoryFixture({reserved: 20_000_000}),
        attachments: MetricHistoryFixture({reserved: 1}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
        profileDuration: MetricHistoryFixture({reserved: 1}),
        replays: MetricHistoryFixture({reserved: 10_000}),
      },
      onDemandMaxSpend: 2000,
    });
    SubscriptionStore.set(organization.slug, am2BizSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM2}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am2'},
        })
      );
    });

    assertCheckoutSteps({tier: PlanTier.AM2});

    // Verify that Business is preselected
    expect(screen.getByRole('radio', {name: 'Business'})).toBeChecked();
  });
});

describe('Default Tier Checkout', () => {
  const api = new MockApiClient();
  const organization = OrganizationFixture({});
  let mockBillingConfigResponse: any;

  beforeEach(() => {
    organization.features = ['ondemand-budgets', 'am3-billing'];
    MockApiClient.clearMockResponses();
    mockBillingConfigResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
    });
  });

  it('renders', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        checkoutTier={PlanTier.AM3}
        navigate={jest.fn()}
        api={api}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockBillingConfigResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am3'},
        })
      );
    });

    assertCheckoutSteps({tier: PlanTier.AM3});
  });

  it('renders for new customers (default free plan)', async () => {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
    });
    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockBillingConfigResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am3'},
        })
      );
    });

    assertCheckoutSteps({tier: PlanTier.AM3});
  });

  it('renders for customers migrating from partner billing', async () => {
    organization.features.push('partner-billing-migration');
    const contractPeriodEnd = moment();
    const sub = SubscriptionFixture({
      organization,
      contractPeriodEnd: contractPeriodEnd.toISOString(),
      plan: 'am2_sponsored_team_auf',
      planTier: PlanTier.AM2,
      isSponsored: true,
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
    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockBillingConfigResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am3'},
        })
      );
    });

    assertCheckoutSteps({tier: PlanTier.AM3});

    expect(
      screen.getByText(
        'Your promotional plan with FOO ends on ' + contractPeriodEnd.format('ll') + '.'
      )
    ).toBeInTheDocument();

    // 500 replays from sponsored plan becomes 50 on am3
    expect(screen.getByTestId('replays-volume-item')).toHaveTextContent('50');
  });

  it('renders for self-serve partners', async () => {
    const contractPeriodEnd = moment();
    const sub = SubscriptionFixture({
      organization,
      contractPeriodEnd: contractPeriodEnd.toISOString(),
      plan: 'am3_f',
      planTier: PlanTier.AM3,
      isSelfServePartner: true,
      partner: {
        isActive: true,
        externalId: 'foo',
        partnership: {
          id: 'XX',
          displayName: 'BAR',
          supportNote: '',
        },
        name: '',
      },
    });
    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockBillingConfigResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am3'},
        })
      );
    });

    assertCheckoutSteps({tier: PlanTier.AM3, hasBillingInfoStep: false});
    expect(
      screen.queryByText(
        'Your promotional plan with BAR ends on ' + contractPeriodEnd.format('ll') + '.'
      )
    ).not.toBeInTheDocument();
  });

  it('renders banner for self-serve partners', async () => {
    const contractPeriodEnd = moment();
    const sub = SubscriptionFixture({
      organization,
      contractPeriodEnd: contractPeriodEnd.toISOString(),
      plan: 'am3_f',
      planTier: PlanTier.AM3,
      isSelfServePartner: true,
      partner: {
        isActive: true,
        externalId: 'foo',
        partnership: {
          id: 'XX',
          displayName: 'BAR',
          supportNote: '',
        },
        name: '',
      },
    });
    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockBillingConfigResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am3'},
        })
      );
    });

    assertCheckoutSteps({tier: PlanTier.AM3, hasBillingInfoStep: false});
    expect(
      screen.getByText('Billing handled externally through BAR')
    ).toBeInTheDocument();
  });

  it('renders for VC partners', async () => {
    organization.features.push('vc-marketplace-active-customer');
    const contractPeriodEnd = moment();
    const sub = SubscriptionFixture({
      organization,
      contractPeriodEnd: contractPeriodEnd.toISOString(),
      plan: 'am3_f',
      planTier: PlanTier.AM3,
      isSelfServePartner: true,
      partner: {
        isActive: true,
        externalId: 'foo',
        partnership: {
          id: 'XX',
          displayName: 'XX',
          supportNote: '',
        },
        name: '',
      },
    });
    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockBillingConfigResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am3'},
        })
      );
    });

    assertCheckoutSteps({
      tier: PlanTier.AM3,
      hasBillingInfoStep: false,
      hasBillingCycleStep: false,
    });
  });
  it('renders for customers switching to default tier', async () => {
    const sub = SubscriptionFixture({
      organization,
      // This plan does not have hasOnDemandModes
      plan: 'mm2_b_100k',
      planTier: PlanTier.AM2,
    });
    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockBillingConfigResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am3'},
        })
      );
    });
    expect(hasOnDemandBudgetsFeature(organization, sub)).toBe(false);
    assertCheckoutSteps({tier: PlanTier.AM3});
    expect(screen.getByRole('radio', {name: 'Business'})).toBeChecked();
  });

  it('prefills with existing subscription data', async () => {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_business',
      planTier: PlanTier.AM3,
      onDemandBudgets: {
        onDemandSpendUsed: 0,
        sharedMaxBudget: 2000,
        budgetMode: OnDemandBudgetMode.SHARED,
        enabled: true,
      },
      onDemandMaxSpend: 2000,
      supportsOnDemand: true,
      isFree: false,
    });
    sub.categories = {
      ...sub.categories,
      errors: MetricHistoryFixture({reserved: 100_000}),
      attachments: MetricHistoryFixture({reserved: 25}),
      spans: MetricHistoryFixture({reserved: 20_000_000}),
    };
    sub.addOns = {
      ...sub.addOns,
      [AddOnCategory.SEER]: {
        ...sub.addOns?.[AddOnCategory.SEER]!,
        enabled: true,
      },
    };

    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockBillingConfigResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am3'},
        })
      );
    });

    expect(
      screen.getByRole('textbox', {name: 'Custom shared spending limit (in dollars)'})
    ).toHaveValue('20');
    expect(screen.getByTestId('errors-volume-item')).toHaveTextContent('100K');
    expect(screen.getByTestId('attachments-volume-item')).toHaveTextContent('25 GB');
    expect(screen.getByTestId('spans-volume-item')).toHaveTextContent('20M');

    // other categories use defaults
    expect(screen.getByTestId('replays-volume-item')).toHaveTextContent('50');

    expect(screen.getByTestId('product-option-seer')).toBeChecked();
  });

  it('prefills with existing subscription data with plan trial', async () => {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_business',
      planTier: PlanTier.AM3,
      onDemandBudgets: {
        onDemandSpendUsed: 0,
        sharedMaxBudget: 2000,
        budgetMode: OnDemandBudgetMode.SHARED,
        enabled: true,
      },
      onDemandMaxSpend: 2000,
      supportsOnDemand: true,
      isFree: false,
      isTrial: true, // isTrial is true for both subscription trials and plan trials
    });
    sub.categories = {
      ...sub.categories,
      errors: MetricHistoryFixture({reserved: 100_000}),
      attachments: MetricHistoryFixture({reserved: 25}),
      spans: MetricHistoryFixture({reserved: 20_000_000}),
    };
    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockBillingConfigResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am3'},
        })
      );
    });

    expect(
      screen.getByRole('textbox', {name: 'Custom shared spending limit (in dollars)'})
    ).toHaveValue('20');
    expect(screen.getByTestId('errors-volume-item')).toHaveTextContent('100K');
    expect(screen.getByTestId('attachments-volume-item')).toHaveTextContent('25 GB');
    expect(screen.getByTestId('spans-volume-item')).toHaveTextContent('20M');

    // other categories use defaults
    expect(screen.getByTestId('replays-volume-item')).toHaveTextContent('50');

    expect(screen.getByTestId('product-option-seer')).not.toBeChecked();
  });

  it('handles missing categories in subscription.categories', async () => {
    /**
     * In this test, we create a subscription where some categories are missing from
     * `subscription.categories`. We then verify that the component renders correctly
     * without throwing errors, and that the missing categories default to a reserved
     * value of 0.
     */
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_business',
      planTier: PlanTier.AM3,
      categories: {
        // Intentionally omitting 'errors' and 'attachments' categories
        replays: MetricHistoryFixture({reserved: 50}),
        monitorSeats: MetricHistoryFixture({reserved: 1}),
        spans: MetricHistoryFixture({reserved: 1}),
        profileDuration: MetricHistoryFixture({reserved: 1}),
      },
      onDemandBudgets: {
        onDemandSpendUsed: 0,
        sharedMaxBudget: 2000,
        budgetMode: OnDemandBudgetMode.SHARED,
        enabled: true,
      },
      supportsOnDemand: true,
      isFree: false,
    });

    // set all add-ons as unavailable so we don't check for them in order to skip the step
    sub.addOns = {
      ...sub.addOns,
      [AddOnCategory.SEER]: {
        ...sub.addOns?.[AddOnCategory.SEER]!,
        isAvailable: false,
      },
      [AddOnCategory.LEGACY_SEER]: {
        ...sub.addOns?.[AddOnCategory.LEGACY_SEER]!,
        isAvailable: false,
      },
    };

    SubscriptionStore.set(organization.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockBillingConfigResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am3'},
        })
      );
    });

    await userEvent.click(
      screen.getByRole('button', {name: 'Show reserved volume sliders'})
    );
    // Check that missing 'Errors' category defaults to 50,000 errors
    expect(screen.getByTestId('errors-volume-item')).toHaveTextContent('50K');
    // For 'Replays', should be set to 50 as per the subscription
    expect(screen.getByTestId('replays-volume-item')).toHaveTextContent('50');
    // Check that missing 'Attachments' category defaults to 1 GB
    expect(screen.getByTestId('attachments-volume-item')).toHaveTextContent('1 GB');
  });

  it('handles zero platform reserve', () => {
    const formData = {
      plan: 'am3_business',
      reserved: {
        errors: 10000,
        transactions: 0,
        attachments: 0,
        replays: 0,
        monitorSeats: 0,
        profileDuration: 0,
        spans: 0,
      },
    };

    expect(getCheckoutAPIData({formData})).toEqual({
      onDemandBudget: undefined,
      onDemandMaxSpend: 0,
      plan: 'am3_business',
      referrer: 'billing',
      reservedErrors: 10000,
      reservedTransactions: 0,
      reservedAttachments: 0,
      reservedReplays: 0,
      reservedMonitorSeats: 0,
      reservedProfileDuration: 0,
      reservedSpans: 0,
    });
  });

  it('does not use trial volumes for trial subscriptions', async () => {
    /**
     * Test for the trial checkout slider fix in AM3 tier. When subscription.isTrial is true,
     * the checkout should use default volumes instead of trial reserved volumes.
     */

    const trialSub = SubscriptionFixture({
      organization,
      plan: 'am3_t',
      planTier: PlanTier.AM3,
      isTrial: true, // This is true for both subscription trials and plan trials
      categories: {
        // These are high trial volumes that should NOT be used in checkout
        errors: MetricHistoryFixture({reserved: 750_000}), // High trial volume
        attachments: MetricHistoryFixture({reserved: 200}), // High trial volume
        replays: MetricHistoryFixture({reserved: 50_000}), // High trial volume
        spans: MetricHistoryFixture({reserved: 100_000_000}), // High trial volume
        monitorSeats: MetricHistoryFixture({reserved: 20}),
        profileDuration: MetricHistoryFixture({reserved: 20}),
      },
      onDemandBudgets: {
        onDemandSpendUsed: 0,
        sharedMaxBudget: 10000, // High trial budget
        budgetMode: OnDemandBudgetMode.SHARED,
        enabled: true,
      },
      onDemandMaxSpend: 10000,
      supportsOnDemand: true,
      isFree: false,
    });

    SubscriptionStore.set(organization.slug, trialSub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    await waitFor(() => {
      expect(mockBillingConfigResponse).toHaveBeenCalledWith(
        `/customers/${organization.slug}/billing-config/`,
        expect.objectContaining({
          method: 'GET',
          data: {tier: 'am3'},
        })
      );
    });

    // not open by default because it's a trial subscription
    await userEvent.click(
      screen.getByRole('button', {name: 'Show reserved volume sliders'})
    );

    // Verify that sliders show reasonable values, NOT the high trial volumes
    // The key test is that they are NOT the trial volumes we set above
    expect(screen.getByTestId('errors-volume-item')).not.toHaveTextContent('75K');
    expect(screen.getByTestId('attachments-volume-item')).not.toHaveTextContent('200 GB');
    expect(screen.getByTestId('spans-volume-item')).not.toHaveTextContent('100M');
    expect(screen.getByTestId('replays-volume-item')).not.toHaveTextContent('50K');

    // Verify they are default values instead
    expect(screen.getByTestId('errors-volume-item')).toHaveTextContent('50K');
    expect(screen.getByTestId('attachments-volume-item')).toHaveTextContent('1 GB');
    expect(screen.getByTestId('spans-volume-item')).toHaveTextContent('10M');
    expect(screen.getByTestId('replays-volume-item')).toHaveTextContent('50');
  });
});
