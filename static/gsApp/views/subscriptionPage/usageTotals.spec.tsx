import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {
  Am3DsEnterpriseSubscriptionFixture,
  SubscriptionFixture,
} from 'getsentry-test/fixtures/subscription';
import {UsageTotalFixture} from 'getsentry-test/fixtures/usageTotal';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import {GIGABYTE, RESERVED_BUDGET_QUOTA, UNLIMITED_RESERVED} from 'getsentry/constants';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {OnDemandBudgetMode, type Subscription} from 'getsentry/types';
import UsageTotals, {
  calculateCategoryOnDemandUsage,
  calculateCategoryPrepaidUsage,
} from 'getsentry/views/subscriptionPage/usageTotals';

describe('Subscription > UsageTotals', function () {
  const totals = UsageTotalFixture({
    accepted: 26,
    dropped: 10,
    droppedOverQuota: 7,
    droppedSpikeProtection: 1,
    droppedOther: 2,
  });

  const organization = OrganizationFixture();
  let subscription!: Subscription;

  beforeEach(() => {
    subscription = SubscriptionFixture({
      organization,
      plan: 'am3_business',
    });
    SubscriptionStore.set(organization.slug, subscription);
  });

  afterEach(() => {
    SubscriptionStore.init();
  });

  it('calculates error totals and renders them', async function () {
    render(
      <UsageTotals
        category="errors"
        totals={totals}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByText('Errors usage this period')).toBeInTheDocument();
    expect(screen.getByTestId('reserved-errors')).toHaveTextContent('100K Reserved');
    expect(screen.getByText('26')).toBeInTheDocument();

    // Expand usage table
    await userEvent.click(screen.getByRole('button'));

    expect(
      screen.getByRole('row', {name: 'Errors Quantity % of Errors'})
    ).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Accepted 26 72%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Total Dropped 10 28%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Over Quota 7 19%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Spike Protection 1 3%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Other 2 6%'})).toBeInTheDocument();
  });

  it('renders transaction event totals with feature', async function () {
    const am2Subscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
    });
    SubscriptionStore.set(organization.slug, am2Subscription);
    render(
      <UsageTotals
        showEventBreakdown
        category="transactions"
        totals={totals}
        eventTotals={{transactions: totals, profiles: totals}}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        subscription={am2Subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('reserved-transactions')).toHaveTextContent(
      '100K Reserved'
    );
    expect(screen.getByText('26')).toBeInTheDocument();

    // Expand usage table
    await userEvent.click(screen.getByRole('button'));

    expect(
      screen.getByRole('columnheader', {name: 'Transaction Events'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Profile Events'})
    ).toBeInTheDocument();
  });

  it('does not render transaction event totals without feature', async function () {
    const am2Subscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
    });
    SubscriptionStore.set(organization.slug, am2Subscription);
    render(
      <UsageTotals
        category="transactions"
        totals={totals}
        eventTotals={{transactions: totals, profiles: totals}}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        subscription={am2Subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('reserved-transactions')).toHaveTextContent(
      '100K Reserved'
    );
    expect(screen.getByText('26')).toBeInTheDocument();

    // Expand usage table
    await userEvent.click(screen.getByRole('button'));

    expect(
      screen.queryByRole('columnheader', {name: 'Transaction Events'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', {name: 'Profile Events'})
    ).not.toBeInTheDocument();
  });

  it('renders accepted spans in spend mode with reserved budgets and dynamic sampling', async function () {
    const dsSubscription = Am3DsEnterpriseSubscriptionFixture({
      organization,
      hadCustomDynamicSampling: true,
    });
    render(
      <UsageTotals
        showEventBreakdown
        category="spans"
        totals={totals}
        eventTotals={{spans: totals}}
        reservedUnits={RESERVED_BUDGET_QUOTA}
        prepaidUnits={RESERVED_BUDGET_QUOTA}
        prepaidBudget={100_000_00}
        reservedBudget={100_000_00}
        reservedSpend={40_000_00}
        subscription={dsSubscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByText('Accepted spans spend this period')).toBeInTheDocument();
    expect(screen.getByTestId('reserved-spans')).toHaveTextContent(
      '$100,000.00 Reserved'
    );
    expect(screen.getByText('$40,000')).toBeInTheDocument();
    expect(screen.getByText('40% of $100,000')).toBeInTheDocument();

    // Expand usage table
    await userEvent.click(screen.getByRole('button'));

    expect(
      screen.getByRole('row', {name: 'Accepted Spans Quantity % of Accepted Spans'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Accepted Spans'})
    ).toBeInTheDocument();
  });

  it('renders spans with reserved budgets without dynamic sampling', async function () {
    const dsSubscription = Am3DsEnterpriseSubscriptionFixture({
      organization,
      hadCustomDynamicSampling: false,
    });
    render(
      <UsageTotals
        showEventBreakdown
        category="spans"
        totals={totals}
        eventTotals={{spans: totals}}
        reservedUnits={RESERVED_BUDGET_QUOTA}
        prepaidUnits={RESERVED_BUDGET_QUOTA}
        prepaidBudget={100_000_00}
        reservedBudget={100_000_00}
        reservedSpend={60_000_00}
        subscription={dsSubscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByText('Spans spend this period')).toBeInTheDocument();
    expect(screen.getByTestId('reserved-spans')).toHaveTextContent(
      '$100,000.00 Reserved'
    );
    expect(screen.getByText('$60,000')).toBeInTheDocument();
    expect(screen.getByText('60% of $100,000')).toBeInTheDocument();

    // Expand usage table
    await userEvent.click(screen.getByRole('button'));

    expect(
      screen.getByRole('row', {name: 'Spans Quantity % of Spans'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Spans'})).toBeInTheDocument();
  });

  it('renders reserved budget categories with gifted budget', function () {
    const dsSubscription = Am3DsEnterpriseSubscriptionFixture({
      organization,
      hadCustomDynamicSampling: true,
    });
    render(
      <UsageTotals
        category="spans"
        totals={totals}
        eventTotals={{spans: totals}}
        reservedUnits={RESERVED_BUDGET_QUOTA}
        prepaidUnits={RESERVED_BUDGET_QUOTA}
        prepaidBudget={110_000_00}
        reservedBudget={100_000_00}
        reservedSpend={60_000_00}
        freeBudget={10_000_00}
        subscription={dsSubscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('gifted-spans')).toHaveTextContent(
      '$100,000.00 Reserved + $10,000.00 Gifted'
    );
    expect(screen.getByText('55% of $110,000')).toBeInTheDocument();
  });

  it('renders reserved budget categories with soft cap', function () {
    const dsSubscription = Am3DsEnterpriseSubscriptionFixture({
      organization,
      hadCustomDynamicSampling: true,
    });
    render(
      <UsageTotals
        category="spans"
        totals={totals}
        eventTotals={{spans: totals}}
        reservedUnits={RESERVED_BUDGET_QUOTA}
        prepaidUnits={RESERVED_BUDGET_QUOTA}
        prepaidBudget={100_000_00}
        reservedBudget={100_000_00}
        reservedSpend={60_000_00}
        softCapType="ON_DEMAND"
        subscription={dsSubscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('reserved-spans')).toHaveTextContent(
      '$100,000.00 Reserved (On Demand)'
    );
  });

  it('formats units', async function () {
    render(
      <UsageTotals
        category="attachments"
        totals={totals}
        reservedUnits={100}
        prepaidUnits={100}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );
    expect(screen.getByTestId('reserved-attachments')).toHaveTextContent(
      '100 GB Reserved'
    );

    // Expand usage table
    await userEvent.click(screen.getByRole('button'));

    expect(
      screen.getByRole('row', {name: 'Attachments Quantity % of Attachments'})
    ).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Accepted 26 B 72%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Total Dropped 10 B 28%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Over Quota 7 B 19%'})).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Spike Protection 1 B 3%'})
    ).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Other 2 B 6%'})).toBeInTheDocument();
  });

  it('renders default stats with no billing history', function () {
    render(
      <UsageTotals
        category="transactions"
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByText('Transactions usage this period')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders gifted errors', function () {
    render(
      <UsageTotals
        category="errors"
        totals={UsageTotalFixture({accepted: 175_000})}
        reservedUnits={50_000}
        freeUnits={150_000}
        prepaidUnits={200_000}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByText('175,000')).toBeInTheDocument();
    expect(screen.getByTestId('gifted-errors')).toHaveTextContent(
      '50K Reserved + 150K Gifted'
    );
  });

  it('renders gifted transactions', function () {
    render(
      <UsageTotals
        category="transactions"
        totals={totals}
        reservedUnits={100_000}
        freeUnits={200_000}
        prepaidUnits={300_000}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );
    expect(screen.getByTestId('gifted-transactions')).toHaveTextContent(
      '100K Reserved + 200K Gifted'
    );
  });

  it('does not render gifted transactions with unlimited quota', function () {
    render(
      <UsageTotals
        category="transactions"
        totals={totals}
        reservedUnits={UNLIMITED_RESERVED}
        freeUnits={200_000}
        prepaidUnits={UNLIMITED_RESERVED}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );
    expect(screen.getByTestId('reserved-transactions')).toHaveTextContent('∞ Reserved');
  });

  it('renders gifted attachments', function () {
    render(
      <UsageTotals
        category="attachments"
        totals={totals}
        freeUnits={2}
        reservedUnits={1}
        prepaidUnits={1}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );
    expect(screen.getByTestId('gifted-attachments')).toHaveTextContent(
      '1 GB Reserved + 2 GB Gifted'
    );
  });

  it('renders accepted percentage for attachments', function () {
    const attachments = UsageTotalFixture({accepted: GIGABYTE * 0.6});
    render(
      <UsageTotals
        category="attachments"
        totals={attachments}
        reservedUnits={1}
        prepaidUnits={1}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );
    expect(screen.getByText('600 MB')).toBeInTheDocument();
  });

  it('renders accepted percentage for errors', function () {
    const errors = UsageTotalFixture({accepted: 92_400});
    render(
      <UsageTotals
        category={DataCategory.ERRORS}
        totals={errors}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );
    expect(screen.getByText('92,400')).toBeInTheDocument();
  });

  it('renders accepted percentage for transactions', function () {
    const transactions = UsageTotalFixture({accepted: 200_000});
    render(
      <UsageTotals
        category={DataCategory.TRANSACTIONS}
        totals={transactions}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );
    expect(screen.getByText('200,000')).toBeInTheDocument();
  });

  it('renders true forward', function () {
    render(
      <UsageTotals
        trueForward
        category="errors"
        totals={totals}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );
    expect(screen.getByTestId('reserved-errors')).toHaveTextContent(
      '100K Reserved (True Forward)'
    );
  });

  it('renders soft cap type on demand', function () {
    render(
      <UsageTotals
        softCapType="ON_DEMAND"
        category="errors"
        totals={totals}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );
    expect(screen.getByTestId('reserved-errors')).toHaveTextContent(
      '100K Reserved (On Demand)'
    );
  });

  it('renders soft cap type true forward', function () {
    render(
      <UsageTotals
        softCapType="TRUE_FORWARD"
        category="errors"
        totals={totals}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );
    expect(screen.getByTestId('reserved-errors')).toHaveTextContent(
      '100K Reserved (True Forward)'
    );
  });

  it('renders true forward with gifted amount', function () {
    render(
      <UsageTotals
        trueForward
        category="errors"
        totals={totals}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        freeUnits={50_000}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );
    expect(screen.getByTestId('gifted-errors')).toHaveTextContent(
      '100K Reserved (True Forward) + 50K Gifted'
    );
  });

  it('renders soft cap type on demand with gifted amount', function () {
    render(
      <UsageTotals
        softCapType="ON_DEMAND"
        category="errors"
        totals={totals}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        freeUnits={50_000}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );
    expect(screen.getByTestId('gifted-errors')).toHaveTextContent(
      '100K Reserved (On Demand) + 50K Gifted'
    );
  });

  it('renders soft cap type true forward with gifted amount', function () {
    render(
      <UsageTotals
        softCapType="TRUE_FORWARD"
        category="errors"
        totals={totals}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        freeUnits={50_000}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );
    expect(screen.getByTestId('gifted-errors')).toHaveTextContent(
      '100K Reserved (True Forward) + 50K Gifted'
    );
  });

  it('renders usage card with Trial if an active trial exists', function () {
    subscription.productTrials = [
      {
        category: DataCategory.REPLAYS,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(10, 'days').format(),
        endDate: moment().utc().add(20, 'days').format(),
      },
    ];
    render(
      <UsageTotals
        category="replays"
        totals={totals}
        reservedUnits={500}
        prepaidUnits={500}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByText('Replays trial usage this period')).toBeInTheDocument();
    expect(screen.queryByText('Start trial')).not.toBeInTheDocument();
  });

  it('renders usage card with Start trial button if a potential trial exists', function () {
    subscription.productTrials = [
      {
        category: DataCategory.REPLAYS,
        isStarted: false,
        reasonCode: 1001,
        startDate: undefined,
        endDate: moment().utc().add(20, 'years').format(),
      },
    ];
    render(
      <UsageTotals
        category="replays"
        totals={totals}
        reservedUnits={500}
        prepaidUnits={500}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByText('Replays usage this period')).toBeInTheDocument();
    expect(screen.queryByText('Replays Trial')).not.toBeInTheDocument();
    expect(screen.getByText('Start trial')).toBeInTheDocument();
  });

  it('renders usage card as normal if trial has ended', function () {
    subscription.productTrials = [
      {
        category: DataCategory.REPLAYS,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(10, 'days').format(),
        endDate: moment().utc().subtract(1, 'days').format(),
      },
    ];
    render(
      <UsageTotals
        category="replays"
        totals={totals}
        reservedUnits={500}
        prepaidUnits={500}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByText('Replays usage this period')).toBeInTheDocument();
    expect(screen.queryByText('Replays Trial')).not.toBeInTheDocument();
    expect(screen.queryByText('Start trial')).not.toBeInTheDocument();
  });

  it('renders total usage in dollars', () => {
    const spendSubscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      planTier: 'am2',
    });
    const prepaidUsage = 100_000;
    const prepaid = prepaidUsage * 2;
    spendSubscription.categories.errors = MetricHistoryFixture({
      prepaid,
      reserved: prepaid,
    });
    const spendTotals = UsageTotalFixture({
      accepted: prepaidUsage,
      dropped: 100_000,
    });
    render(
      <UsageTotals
        category="errors"
        totals={spendTotals}
        reservedUnits={200_000}
        prepaidUnits={200_000}
        subscription={spendSubscription}
        organization={organization}
        displayMode="cost"
      />
    );

    expect(screen.getByText('Errors spend this period')).toBeInTheDocument();
    expect(screen.getByText('$32 Included in Subscription')).toBeInTheDocument();
    expect(screen.getByText('50% of $32')).toBeInTheDocument();
  });

  it('renders total usage', () => {
    const spendSubscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      planTier: 'am2',
    });
    const prepaidUsage = 100_000;
    const prepaid = prepaidUsage * 2;
    spendSubscription.categories.errors = MetricHistoryFixture({
      prepaid,
      reserved: prepaid,
    });
    const spendTotals = UsageTotalFixture({
      accepted: prepaidUsage,
      dropped: 100_000,
    });
    render(
      <UsageTotals
        category="errors"
        totals={spendTotals}
        reservedUnits={200_000}
        prepaidUnits={200_000}
        subscription={spendSubscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByText('Errors usage this period')).toBeInTheDocument();
    const totalUsageContainer = screen.getByText('Total Usage');
    expect(totalUsageContainer).toBeInTheDocument();
    expect(totalUsageContainer.parentElement).toHaveTextContent('100,000Total Usage');
    expect(screen.getByText('100K of 200K')).toBeInTheDocument();
  });

  it('displays plan usage when there is no spend', () => {
    render(
      <UsageTotals
        category="errors"
        totals={totals}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        subscription={subscription}
        organization={organization}
        displayMode="cost"
      />
    );

    // Spend is 0, so we should display included plan usage
    expect(screen.getByText('Included in Subscription')).toBeInTheDocument();
    expect(screen.getByText('26 of 100K')).toBeInTheDocument();
  });

  it('displays shared On-Demand max available when another category has used some', () => {
    organization.features = ['ondemand-budgets'];
    const onDemandCategoryMax = 8000;
    const onDemandSubscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      planTier: 'am2',
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        enabled: true,
        onDemandSpendUsed: onDemandCategoryMax,
        sharedMaxBudget: onDemandCategoryMax,
      },
    });
    const prepaid = 200_000;
    onDemandSubscription.categories.errors = MetricHistoryFixture({
      prepaid,
      reserved: prepaid,
      // Errors uses half of the shared on demand budget
      onDemandSpendUsed: onDemandCategoryMax / 2,
    });
    // Performance uses some as well
    onDemandSubscription.categories.transactions = MetricHistoryFixture({
      onDemandSpendUsed: onDemandCategoryMax / 4,
    });

    render(
      <UsageTotals
        category="errors"
        totals={totals}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        subscription={onDemandSubscription}
        organization={organization}
        displayMode="cost"
      />
    );

    // Errors has used 50% and it could spend another $20 since performance has used $20
    expect(screen.getByText('$40 of $60 ($80 max)')).toBeInTheDocument();
    expect(
      screen.getByText('$32 Included in Subscription + $40 On-Demand')
    ).toBeInTheDocument();
  });

  it('displays pay-as-you-go max available when another category has used some', () => {
    organization.features = ['ondemand-budgets'];
    const onDemandCategoryMax = 8000;
    const paygSubscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      planTier: 'am3',
      onDemandMaxSpend: 8000,
    });
    const prepaid = 200_000;
    paygSubscription.categories.errors = MetricHistoryFixture({
      prepaid,
      reserved: prepaid,
      // Errors uses half of the shared on demand budget
      onDemandSpendUsed: onDemandCategoryMax / 2,
    });
    // Spans uses some as well
    paygSubscription.categories.spans = MetricHistoryFixture({
      onDemandSpendUsed: onDemandCategoryMax / 4,
    });

    render(
      <UsageTotals
        category="errors"
        totals={totals}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        subscription={paygSubscription}
        organization={organization}
        displayMode="cost"
      />
    );

    // Errors has used 50% and it could spend another $20 since performance has used $20
    expect(screen.getByText('$40 of $60 ($80 max)')).toBeInTheDocument();
    expect(
      screen.getByText('$51 Included in Subscription + $40 Pay-as-you-go')
    ).toBeInTheDocument();
  });

  it('renders onDemandUsage when over prepaidTotal', function () {
    const usageTotals = UsageTotalFixture({
      accepted: 150_000,
      dropped: 10,
      droppedOverQuota: 7,
      droppedSpikeProtection: 1,
      droppedOther: 2,
    });

    organization.features = ['ondemand-budgets'];
    const paygSubscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      planTier: 'am3',
      onDemandMaxSpend: 10_00, // $10.00
    });

    paygSubscription.categories.errors = MetricHistoryFixture({
      reserved: 100_000,
      onDemandQuantity: 50_000,
    });

    render(
      <UsageTotals
        category="errors"
        totals={usageTotals}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        subscription={paygSubscription}
        organization={organization}
        displayMode="usage"
      />
    );

    // Test the header section
    expect(screen.getByText('Errors usage this period')).toBeInTheDocument();
    expect(screen.getByTestId('reserved-errors')).toHaveTextContent('100K Reserved');

    // Test the Pay-as-you-go section
    expect(screen.getByText('Pay-as-you-go')).toBeInTheDocument();
    expect(screen.getByText('50,000')).toBeInTheDocument(); // On-demand usage amount

    // Test the included subscription section
    const includedSection = screen.getByText('Included in Subscription').parentElement;
    expect(includedSection).toHaveTextContent('100K of 100K');

    // Test the total usage section
    const totalUsageSection = screen.getByText('Total Usage').parentElement;
    expect(totalUsageSection).toHaveTextContent('150,000');

    // Verify expand button exists
    expect(screen.getByLabelText('Expand usage totals')).toBeInTheDocument();

    // Test the usage bars are rendered
    const usageBarContainer = document.querySelector('[class*="PlanUseBarContainer"]');
    expect(usageBarContainer).toBeInTheDocument();

    // Verify both prepaid and on-demand bars exist
    const usageBars = document.querySelectorAll(
      '[class*="PlanUseBarGroup"] > [class*="PlanUseBar"]'
    );
    expect(usageBars).toHaveLength(2);
  });

  it('does not render onDemandUsage when under prepaidTotal', function () {
    const usageTotals = UsageTotalFixture({
      accepted: 100_000,
      dropped: 10,
      droppedOverQuota: 7,
      droppedSpikeProtection: 1,
      droppedOther: 2,
    });

    organization.features = ['ondemand-budgets'];
    const paygSubscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      planTier: 'am3',
      onDemandMaxSpend: 10_00, // $10.00
    });

    paygSubscription.categories.errors = MetricHistoryFixture({
      reserved: 100_000,
      onDemandQuantity: 0,
    });

    render(
      <UsageTotals
        category="errors"
        totals={usageTotals}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        subscription={paygSubscription}
        organization={organization}
        displayMode="usage"
      />
    );

    // Test the header section
    expect(screen.getByText('Errors usage this period')).toBeInTheDocument();
    expect(screen.getByTestId('reserved-errors')).toHaveTextContent('100K Reserved');

    // Test the Pay-as-you-go section
    expect(screen.getByText('Pay-as-you-go')).toBeInTheDocument();
    const paygUsage = screen.getByText('0', {
      selector: '[class*="LegendContainer"] [class*="LegendPrice"]',
    });
    expect(paygUsage).toBeInTheDocument();
    expect(paygUsage).toHaveTextContent(/^0$/); // On-demand usage amount

    // Test the included subscription section
    const includedSection = screen.getByText('Included in Subscription').parentElement;
    expect(includedSection).toHaveTextContent('100K of 100K');

    // Test the total usage section
    const totalUsageSection = screen.getByText('Total Usage').parentElement;
    expect(totalUsageSection).toHaveTextContent('100,000');

    // Verify expand button exists
    expect(screen.getByLabelText('Expand usage totals')).toBeInTheDocument();

    // Test the usage bars are rendered
    const usageBarContainer = document.querySelector('[class*="PlanUseBarContainer"]');
    expect(usageBarContainer).toBeInTheDocument();

    // Verify both prepaid and on-demand bars exist
    const usageBars = document.querySelectorAll(
      '[class*="PlanUseBarGroup"] > [class*="PlanUseBar"]'
    );
    expect(usageBars).toHaveLength(2);
  });
});

describe('calculateCategoryPrepaidUsage', () => {
  const organization = OrganizationFixture();
  it('calculates prepaid usage of 50%', () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      planTier: 'am2',
    });
    const prepaidUsage = 150_000;
    const prepaid = prepaidUsage * 2;
    subscription.categories.errors = MetricHistoryFixture({
      prepaid,
      reserved: prepaid,
    });
    const totals = UsageTotalFixture({
      accepted: prepaidUsage,
      dropped: 100_000,
    });
    expect(
      calculateCategoryPrepaidUsage('errors', subscription, totals, prepaid)
    ).toEqual({
      onDemandUsage: 0,
      prepaidPercentUsed: 50,
      prepaidPrice: 5000,
      prepaidSpend: 2500,
      prepaidUsage,
    });
  });
  it('converts annual prepaid price to monthly', () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      planTier: 'am2',
    });
    subscription.planDetails.billingInterval = 'annual';
    const prepaidPrice = 10000;
    subscription.planDetails.planCategories.errors = [
      {events: 100_000, price: prepaidPrice * 12, unitPrice: 0.1, onDemandPrice: 0.2},
    ];
    const totals = UsageTotalFixture();
    expect(
      calculateCategoryPrepaidUsage('errors', subscription, totals, prepaidPrice)
    ).toEqual({
      onDemandUsage: 0,
      prepaidPercentUsed: 0,
      prepaidPrice,
      prepaidSpend: 0,
      prepaidUsage: 0,
    });
  });

  it('should not error when prices are not available', () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      planTier: 'am2',
    });
    const prepaidPrice = 0;
    delete subscription.planDetails.planCategories.monitorSeats;
    const totals = UsageTotalFixture();
    expect(
      calculateCategoryPrepaidUsage('monitorSeats', subscription, totals, prepaidPrice)
    ).toEqual({
      onDemandUsage: 0,
      prepaidPercentUsed: 0,
      prepaidPrice: 0,
      prepaidSpend: 0,
      prepaidUsage: 0,
    });
  });
  it('on-demand usage should be zero for unlimited reserve', () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_t',
      planTier: 'am3',
    });
    const prepaidUsage = 10;
    const prepaid = -1;
    subscription.categories.monitorSeats = MetricHistoryFixture({
      prepaid,
      reserved: prepaid,
    });
    const totals = UsageTotalFixture({
      accepted: prepaidUsage,
      dropped: 0,
    });
    expect(
      calculateCategoryPrepaidUsage('monitorSeats', subscription, totals, prepaid)
    ).toEqual({
      onDemandUsage: 0,
      prepaidPercentUsed: 0,
      prepaidPrice: 0,
      prepaidSpend: 0,
      prepaidUsage,
    });
  });

  it('calculates onDemandUsage using categoryInfo.onDemandQuantity when over prepaidTotal', () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      planTier: 'am2',
    });
    const prepaid = 100_000;
    const totals = UsageTotalFixture({
      accepted: 150_000, // totals.accepted > prepaidTotal
    });
    subscription.categories.errors = MetricHistoryFixture({
      reserved: prepaid,
      onDemandQuantity: 50_000,
    });

    const result = calculateCategoryPrepaidUsage('errors', subscription, totals, prepaid);

    expect(result.onDemandUsage).toBe(50_000);
    expect(result.prepaidUsage).toBe(100_000);
  });

  it('sets onDemandUsage to zero when totals.accepted <= prepaidTotal', () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      planTier: 'am2',
    });
    const prepaid = 100_000;
    const totals = UsageTotalFixture({
      accepted: 80_000, // totals.accepted <= prepaidTotal
    });
    subscription.categories.errors = MetricHistoryFixture({
      reserved: prepaid,
      onDemandQuantity: 0,
    });

    const result = calculateCategoryPrepaidUsage('errors', subscription, totals, prepaid);

    expect(result.onDemandUsage).toBe(0);
    expect(result.prepaidUsage).toBe(80_000);
  });

  it('sets onDemandUsage to zero when isUnlimitedReserved(prepaidTotal) is true', () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      planTier: 'am2',
    });
    const prepaid = UNLIMITED_RESERVED;
    const totals = UsageTotalFixture({
      accepted: 150_000,
    });
    subscription.categories.errors = MetricHistoryFixture({
      reserved: prepaid,
      onDemandQuantity: 50_000,
    });

    const result = calculateCategoryPrepaidUsage('errors', subscription, totals, prepaid);

    expect(result.onDemandUsage).toBe(0);
    expect(result.prepaidUsage).toBe(150_000);
  });

  it('calculates for reserved budgets with reserved spend', function () {
    const subscription = Am3DsEnterpriseSubscriptionFixture({organization});
    const prepaid = 100_000_00;
    const totals = UsageTotalFixture({
      accepted: 150_000,
    });
    subscription.categories.spans!.onDemandQuantity = 50_000;

    const result = calculateCategoryPrepaidUsage(
      'spans',
      subscription,
      totals,
      prepaid,
      undefined,
      10_000_00
    );

    expect(result).toEqual({
      onDemandUsage: 0,
      prepaidPercentUsed: 10,
      prepaidPrice: 100_000_00,
      prepaidSpend: 10_000_00,
      prepaidUsage: 150_000,
    });

    const result2 = calculateCategoryPrepaidUsage(
      'spans',
      subscription,
      totals,
      prepaid,
      undefined,
      100_000_00
    );
    expect(result2).toEqual({
      onDemandUsage: 50_000,
      prepaidPercentUsed: 100,
      prepaidPrice: 100_000_00,
      prepaidSpend: 100_000_00,
      prepaidUsage: 100_000,
    });
  });

  it('calculates for reserved budgets with reserved cpe', function () {
    const subscription = Am3DsEnterpriseSubscriptionFixture({organization});
    const prepaid = 100_000_00;
    const totals = UsageTotalFixture({
      accepted: 150_000,
    });
    subscription.categories.spans!.onDemandQuantity = 50_000;

    const result = calculateCategoryPrepaidUsage(
      'spans',
      subscription,
      totals,
      prepaid,
      100
    );

    expect(result).toEqual({
      onDemandUsage: 50_000,
      prepaidPercentUsed: 100,
      prepaidPrice: 100_000_00,
      prepaidSpend: 100_000_00,
      prepaidUsage: 100_000,
    });
  });
});

describe('calculateCategoryOnDemandUsage', () => {
  const organization = OrganizationFixture();
  it('calculates on demand shared fully used by this category', () => {
    const onDemandCategoryMax = 8000;
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      planTier: 'am2',
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        enabled: true,
        onDemandSpendUsed: onDemandCategoryMax,
        sharedMaxBudget: onDemandCategoryMax,
      },
    });
    subscription.categories.errors = MetricHistoryFixture({
      onDemandSpendUsed: onDemandCategoryMax,
    });
    expect(calculateCategoryOnDemandUsage('errors', subscription)).toEqual({
      onDemandTotalAvailable: onDemandCategoryMax,
      onDemandCategoryMax,
      onDemandCategorySpend: onDemandCategoryMax,
      ondemandPercentUsed: 100,
    });
  });

  it('calculates on demand shared used 100% by another category', () => {
    const onDemandCategoryMax = 8000;
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      planTier: 'am2',
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        enabled: true,
        onDemandSpendUsed: onDemandCategoryMax,
        sharedMaxBudget: onDemandCategoryMax,
      },
    });
    subscription.categories.errors = MetricHistoryFixture({
      onDemandSpendUsed: 0,
    });
    expect(calculateCategoryOnDemandUsage('errors', subscription)).toEqual({
      onDemandTotalAvailable: onDemandCategoryMax,
      onDemandCategoryMax,
      onDemandCategorySpend: 0,
      ondemandPercentUsed: 0,
    });
  });

  it('calculates on demand shared used 50% by another category', () => {
    const onDemandCategoryMax = 8000;
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      planTier: 'am2',
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        enabled: true,
        onDemandSpendUsed: onDemandCategoryMax,
        sharedMaxBudget: onDemandCategoryMax,
      },
    });
    // Replays uses half of the shared on demand budget
    subscription.categories.replays = MetricHistoryFixture({
      onDemandSpendUsed: onDemandCategoryMax / 2,
    });
    expect(calculateCategoryOnDemandUsage('errors', subscription)).toEqual({
      onDemandTotalAvailable: onDemandCategoryMax,
      // Half is left for other categories
      onDemandCategoryMax: onDemandCategoryMax / 2,
      onDemandCategorySpend: 0,
      ondemandPercentUsed: 0,
    });
  });
});
