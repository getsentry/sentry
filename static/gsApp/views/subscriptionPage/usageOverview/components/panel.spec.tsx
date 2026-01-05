import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {
  InvoicedSubscriptionFixture,
  SubscriptionFixture,
  SubscriptionWithLegacySeerFixture,
} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {DataCategory} from 'sentry/types/core';

import {UNLIMITED_RESERVED} from 'getsentry/constants';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {AddOnCategory, OnDemandBudgetMode, type Subscription} from 'getsentry/types';
import ProductBreakdownPanel from 'getsentry/views/subscriptionPage/usageOverview/components/panel';

describe('ProductBreakdownPanel', () => {
  const organization = OrganizationFixture();
  let subscription: Subscription;
  const usageData = CustomerUsageFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    setMockDate(new Date('2021-05-07'));
    organization.features = ['subscriptions-v3', 'seer-billing'];
    organization.access = ['org:billing'];
    subscription = SubscriptionFixture({organization, plan: 'am3_business'});
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      body: {
        isSeerConfigured: true,
      },
    });
  });

  afterEach(() => {
    resetMockDate();
  });

  it('renders for data category with shared PAYG set', async () => {
    subscription.categories.errors = {
      ...subscription.categories.errors!,
      reserved: 500_000,
      prepaid: 505_000,
      free: 5_000,
      onDemandSpendUsed: 10_00,
    };
    subscription.onDemandBudgets = {
      enabled: true,
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 100_00,
      onDemandSpendUsed: 0,
    };
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.getByText('Included volume')).toBeInTheDocument();
    expect(screen.getByText('Business plan')).toBeInTheDocument();
    expect(screen.getByText('50,000')).toBeInTheDocument();
    expect(screen.getByText('Additional reserved')).toBeInTheDocument();
    expect(screen.getByText('450,000')).toBeInTheDocument();
    expect(screen.getByText('Gifted')).toBeInTheDocument();
    expect(screen.getByText('5,000')).toBeInTheDocument();
    expect(screen.getByText('Additional spend')).toBeInTheDocument();
    expect(screen.getByText('Pay-as-you-go')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.getByText('Reserved spend')).toBeInTheDocument();
    expect(screen.getByText('$245.00 / month')).toBeInTheDocument();
  });

  it('renders for data category with unlimited reserved', async () => {
    subscription.categories.errors = {
      ...subscription.categories.errors!,
      reserved: UNLIMITED_RESERVED,
      prepaid: UNLIMITED_RESERVED,
    };
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.getByText('Included volume')).toBeInTheDocument();
    expect(screen.getByText('Business plan')).toBeInTheDocument();
    expect(screen.getByText('Unlimited')).toBeInTheDocument();
    expect(screen.queryByText('Additional reserved')).not.toBeInTheDocument();
    expect(screen.queryByText('Gifted')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional spend')).not.toBeInTheDocument();
    expect(screen.queryByText('Pay-as-you-go')).not.toBeInTheDocument();
    expect(screen.queryByText('Reserved spend')).not.toBeInTheDocument();
  });

  it('renders for data category with per-category PAYG set', async () => {
    subscription.categories.errors = {
      ...subscription.categories.errors!,
      reserved: 500_000,
      prepaid: 505_000,
      free: 5_000,
      onDemandSpendUsed: 10_00,
      onDemandBudget: 100_00,
    };
    subscription.onDemandBudgets = {
      enabled: true,
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
      budgets: {
        errors: 100_00,
      },
      usedSpends: {
        errors: 10_00,
      },
    };
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.getByText('Included volume')).toBeInTheDocument();
    expect(screen.getByText('Business plan')).toBeInTheDocument();
    expect(screen.getByText('50,000')).toBeInTheDocument();
    expect(screen.getByText('Additional reserved')).toBeInTheDocument();
    expect(screen.getByText('450,000')).toBeInTheDocument();
    expect(screen.getByText('Gifted')).toBeInTheDocument();
    expect(screen.getByText('5,000')).toBeInTheDocument();
    expect(screen.getByText('Additional spend')).toBeInTheDocument();
    expect(screen.getByText('Pay-as-you-go')).toBeInTheDocument();
    expect(screen.getByText('$10.00 /')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument(); // shows per-category individual budget
    expect(screen.getByText('Reserved spend')).toBeInTheDocument();
    expect(screen.getByText('$245.00 / month')).toBeInTheDocument();
  });

  it('renders for reserved budget add-on', async () => {
    const legacySeerSubscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 100_00,
        onDemandSpendUsed: 0,
      },
    });
    legacySeerSubscription.reservedBudgets![0] = {
      ...legacySeerSubscription.reservedBudgets![0]!,
      freeBudget: 1_00,
    };
    legacySeerSubscription.categories.seerAutofix = {
      ...legacySeerSubscription.categories.seerAutofix!,
      onDemandSpendUsed: 1_00,
    };
    legacySeerSubscription.categories.seerScanner = {
      ...legacySeerSubscription.categories.seerScanner!,
      onDemandSpendUsed: 1_00,
    };
    SubscriptionStore.set(organization.slug, legacySeerSubscription);
    render(
      <ProductBreakdownPanel
        subscription={legacySeerSubscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={AddOnCategory.LEGACY_SEER}
      />
    );

    await screen.findByRole('heading', {name: 'Seer'});
    expect(screen.getByText('Included volume')).toBeInTheDocument();
    expect(screen.queryByText('Business plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional reserved')).not.toBeInTheDocument();
    expect(screen.getByText('Seer monthly credits')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('Gifted')).toBeInTheDocument();
    expect(screen.getByText('$1.00')).toBeInTheDocument();
    expect(screen.getByText('Additional spend')).toBeInTheDocument();
    expect(screen.getByText('Pay-as-you-go')).toBeInTheDocument();
    expect(screen.getByText('$2.00')).toBeInTheDocument();
    expect(screen.getByText('Reserved spend')).toBeInTheDocument();
    expect(screen.getByText('$20.00 / month')).toBeInTheDocument();
  });

  it('renders for reserved budget add-on data category', async () => {
    const legacySeerSubscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 100_00,
        onDemandSpendUsed: 0,
      },
    });
    legacySeerSubscription.reservedBudgets![0] = {
      ...legacySeerSubscription.reservedBudgets![0]!,
      freeBudget: 1_00,
    };
    legacySeerSubscription.categories.seerAutofix = {
      ...legacySeerSubscription.categories.seerAutofix!,
      onDemandSpendUsed: 1_00,
    };
    legacySeerSubscription.categories.seerScanner = {
      ...legacySeerSubscription.categories.seerScanner!,
      onDemandSpendUsed: 1_00,
    };
    SubscriptionStore.set(organization.slug, legacySeerSubscription);
    render(
      <ProductBreakdownPanel
        subscription={legacySeerSubscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.SEER_AUTOFIX}
      />
    );

    await screen.findByRole('heading', {name: 'Issue Fixes'});
    expect(screen.queryByText('Included volume')).not.toBeInTheDocument();
    expect(screen.queryByText('Business plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional reserved')).not.toBeInTheDocument();
    expect(screen.queryByText('Seer monthly credits')).not.toBeInTheDocument();
    expect(screen.queryByText('Gifted')).not.toBeInTheDocument();
    expect(screen.getByText('Additional spend')).toBeInTheDocument();
    expect(screen.getByText('Pay-as-you-go')).toBeInTheDocument();
    expect(screen.getByText('$1.00')).toBeInTheDocument();
    expect(screen.queryByText('Reserved spend')).not.toBeInTheDocument();
  });

  it('renders product trial CTA', async () => {
    subscription.productTrials = [
      {
        category: DataCategory.PROFILE_DURATION,
        isStarted: false,
        reasonCode: 1001,
        startDate: undefined,
        endDate: moment().utc().add(20, 'years').format(),
      },
    ];
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.PROFILE_DURATION}
      />
    );

    expect(
      await screen.findByRole('button', {name: 'Activate free trial'})
    ).toBeInTheDocument();
  });

  it('renders upgrade CTA', async () => {
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.PROFILE_DURATION}
      />
    );

    expect(await screen.findByRole('button', {name: 'Upgrade now'})).toBeInTheDocument();
  });

  it('renders setup CTA for Seer', async () => {
    subscription.addOns!.seer = {
      ...subscription.addOns?.seer!,
      enabled: true,
    };
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      body: {
        isSeerConfigured: false,
      },
    });
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={AddOnCategory.SEER}
      />
    );

    await screen.findByText('Get started with Seer');
    expect(screen.getByRole('button', {name: 'Set Up Seer'})).toBeInTheDocument();
  });

  it('does not render setup CTA for Seer when already setup', async () => {
    subscription.addOns!.seer = {
      ...subscription.addOns?.seer!,
      enabled: true,
    };
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      body: {
        isSeerConfigured: true,
      },
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-seats/current/?billingMetric=seerUsers`,
      body: {},
    });
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={AddOnCategory.SEER}
      />
    );

    await screen.findByRole('heading', {name: 'Seer'});
    expect(screen.queryByText('Get started with Seer')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Set Up Seer'})).not.toBeInTheDocument();
  });

  it('does not render setup CTA for Seer when not yet enabled', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      body: {
        isSeerConfigured: false,
      },
    });
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={AddOnCategory.SEER}
      />
    );

    await screen.findByText('Find and fix issues anywhere with Seer AI debugger'); // subscription hasn't bought Seer so we show upgrade CTA
    expect(screen.queryByText('Get started with Seer')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Set Up Seer'})).not.toBeInTheDocument();
  });

  it('does not render setup CTA for non-Seer', async () => {
    subscription.addOns!.seer = {
      ...subscription.addOns?.seer!,
      enabled: true,
    };
    subscription.addOns!.legacySeer = {
      ...subscription.addOns?.legacySeer!,
      enabled: true, // for testing purposes but you'd never have both IRL
    };
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      body: {
        isSeerConfigured: false,
      },
    });
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={AddOnCategory.LEGACY_SEER}
      />
    );

    await screen.findByRole('heading', {name: 'Seer'});
    expect(screen.queryByText('Get started with Seer')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Set Up Seer'})).not.toBeInTheDocument();
  });

  it('renders active product trial status', async () => {
    subscription.productTrials = [
      {
        category: DataCategory.REPLAYS,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(10, 'days').format(),
        endDate: moment().utc().add(20, 'days').format(),
      },
    ];
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.REPLAYS}
      />
    );

    await screen.findByRole('heading', {name: 'Replays'});
    expect(screen.getByText('Trial - 20 days left')).toBeInTheDocument();
    expect(screen.getByText('Included volume')).toBeInTheDocument();
    expect(screen.getByText('Trial')).toBeInTheDocument();
    expect(screen.getByText('Unlimited')).toBeInTheDocument();
  });

  it('renders usage exceeded status without PAYG set', async () => {
    subscription.categories.errors = {
      ...subscription.categories.errors!,
      usageExceeded: true,
    };
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.getByText('Usage exceeded')).toBeInTheDocument();
  });

  it('renders usage exceeded status with PAYG set', async () => {
    subscription.onDemandBudgets = {
      enabled: true,
      budgetMode: OnDemandBudgetMode.SHARED,
      sharedMaxBudget: 100_00,
      onDemandSpendUsed: 100_00,
    };
    subscription.categories.errors = {
      ...subscription.categories.errors!,
      usageExceeded: true,
    };
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.ERRORS}
      />
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.getByText('Pay-as-you-go limit reached')).toBeInTheDocument();
  });

  it('hides irrelevant breakdown fields', async () => {
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.ERRORS}
      />
    );
    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.getByText('Included volume')).toBeInTheDocument();
    expect(screen.getByText('Business plan')).toBeInTheDocument();
    expect(screen.getByText('50,000')).toBeInTheDocument();
    expect(screen.queryByText('Additional reserved')).not.toBeInTheDocument();
    expect(screen.queryByText('Gifted')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional spend')).not.toBeInTheDocument();
    expect(screen.queryByText('Pay-as-you-go')).not.toBeInTheDocument();
    expect(screen.queryByText('Reserved spend')).not.toBeInTheDocument();
  });

  it('renders for Seer add-on', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-seats/current/?billingMetric=seerUsers`,
      method: 'GET',
      body: [
        {
          billingMetric: DataCategory.SEER_USER,
          created: '2021-01-01',
          displayName: 'johndoe',
          id: 1,
          isTrialSeat: false,
          projectId: 1,
          seatIdentifier: '1234567890',
          status: 'ASSIGNED',
        },

        {
          billingMetric: DataCategory.SEER_USER,
          created: '2021-01-01',
          displayName: 'janedoe',
          id: 2,
          isTrialSeat: false,
          projectId: 1,
          seatIdentifier: '1234567890',
          status: 'ASSIGNED',
        },

        {
          billingMetric: DataCategory.SEER_USER,
          created: '2021-01-01',
          displayName: 'alicebob',
          id: 3,
          isTrialSeat: false,
          projectId: 1,
          seatIdentifier: '1234567890',
          status: 'ASSIGNED',
        },
      ],
    });
    subscription.categories.seerUsers = MetricHistoryFixture({
      category: DataCategory.SEER_USER,
      usage: 3,
      free: 1,
      prepaid: 1,
      reserved: 0,
    });
    subscription.addOns!.seer = {
      ...subscription.addOns!.seer!,
      enabled: true,
    };
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={AddOnCategory.SEER}
      />
    );
    await screen.findByRole('heading', {name: 'Seer'});
    expect(screen.getByText('Included volume')).toBeInTheDocument();
    expect(screen.queryByText('Business plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional reserved')).not.toBeInTheDocument();
    expect(screen.getByText('Gifted')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Additional spend')).toBeInTheDocument();
    expect(screen.queryByText('Pay-as-you-go')).not.toBeInTheDocument();
    expect(screen.queryByText('Reserved spend')).not.toBeInTheDocument();
    expect(screen.getByText('Active contributors spend')).toBeInTheDocument();
    expect(screen.getByText('$80.00')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Configure Seer'})).toBeInTheDocument();

    await screen.findByText('Active Contributors (3)'); // wait for billed seats to be loaded
  });

  it('renders for Seer add-on for non-self-serve subscription', async () => {
    const enterpriseSubscription = InvoicedSubscriptionFixture({
      plan: 'am3_business_ent_auf',
      organization,
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-seats/current/?billingMetric=seerUsers`,
      method: 'GET',
      body: [
        {
          billingMetric: DataCategory.SEER_USER,
          created: '2021-01-01',
          displayName: 'johndoe',
          id: 1,
          isTrialSeat: false,
          projectId: 1,
          seatIdentifier: '1234567890',
          status: 'ASSIGNED',
        },

        {
          billingMetric: DataCategory.SEER_USER,
          created: '2021-01-01',
          displayName: 'janedoe',
          id: 2,
          isTrialSeat: false,
          projectId: 1,
          seatIdentifier: '1234567890',
          status: 'ASSIGNED',
        },

        {
          billingMetric: DataCategory.SEER_USER,
          created: '2021-01-01',
          displayName: 'alicebob',
          id: 3,
          isTrialSeat: false,
          projectId: 1,
          seatIdentifier: '1234567890',
          status: 'ASSIGNED',
        },
      ],
    });
    enterpriseSubscription.categories.seerUsers = MetricHistoryFixture({
      category: DataCategory.SEER_USER,
      usage: 3,
      free: 1,
      prepaid: 3,
      reserved: 2,
    });
    enterpriseSubscription.addOns!.seer = {
      ...subscription.addOns!.seer!,
      enabled: true,
    };
    SubscriptionStore.set(organization.slug, enterpriseSubscription);
    render(
      <ProductBreakdownPanel
        subscription={enterpriseSubscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={AddOnCategory.SEER}
      />
    );
    await screen.findByRole('heading', {name: 'Seer'});
    expect(screen.getByText('Included volume')).toBeInTheDocument();
    expect(screen.getByText('Enterprise (Business) plan')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('Additional reserved')).not.toBeInTheDocument();
    expect(screen.getByText('Gifted')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('Additional spend')).not.toBeInTheDocument();
    expect(screen.queryByText('Pay-as-you-go')).not.toBeInTheDocument();
    expect(screen.queryByText('Reserved spend')).not.toBeInTheDocument();
    expect(screen.queryByText('Active contributors spend')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Configure Seer'})).toBeInTheDocument();

    await screen.findByText('Active Contributors (3)'); // wait for billed seats to be loaded
  });

  it('renders for add-on with missing metric history', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-seats/current/?billingMetric=seerUsers`,
      method: 'GET',
      body: [],
    });
    subscription.addOns!.seer = {
      ...subscription.addOns!.seer!,
      enabled: true,
    };
    subscription.categories.seerUsers = undefined;
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={AddOnCategory.SEER}
      />
    );
    await screen.findByRole('heading', {name: 'Seer'});

    // just nullifies everything
    expect(screen.queryByText('Included volume')).not.toBeInTheDocument();
    expect(screen.queryByText('Business plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional reserved')).not.toBeInTheDocument();
    expect(screen.queryByText('Gifted')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional spend')).not.toBeInTheDocument();
    expect(screen.queryByText('Pay-as-you-go')).not.toBeInTheDocument();
    expect(screen.queryByText('Reserved spend')).not.toBeInTheDocument();
    expect(screen.queryByText('Active contributors spend')).not.toBeInTheDocument();

    await screen.findByText('Active Contributors (0)'); // wait for billed seats to be loaded
  });

  it('renders for data category with missing metric history', async () => {
    // NOTE(isabella): currently, we would never have this case IRL
    // since we would not allow a data category without a metric history to be
    // selectable for the panel, but i've left this test in for completeness
    subscription.categories.errors = undefined;
    render(
      <ProductBreakdownPanel
        subscription={subscription}
        organization={organization}
        usageData={usageData}
        selectedProduct={DataCategory.ERRORS}
      />
    );
    await screen.findByText('Upgrade required');

    // since a data category can only be enabled based on metric history,
    // we will always show full panel upgrade CTA (or product trial CTA if applicable)
    // and thus no breakdown info or heading should be rendered
    expect(screen.queryByRole('heading', {name: 'Errors'})).not.toBeInTheDocument();
    expect(screen.queryByText('Included volume')).not.toBeInTheDocument();
    expect(screen.queryByText('Business plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional reserved')).not.toBeInTheDocument();
    expect(screen.queryByText('Gifted')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional spend')).not.toBeInTheDocument();
    expect(screen.queryByText('Pay-as-you-go')).not.toBeInTheDocument();
    expect(screen.queryByText('Reserved spend')).not.toBeInTheDocument();
  });
});
