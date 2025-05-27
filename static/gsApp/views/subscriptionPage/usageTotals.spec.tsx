import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {SeerReservedBudgetFixture} from 'getsentry-test/fixtures/reservedBudget';
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
import {MILLISECONDS_IN_HOUR} from 'getsentry/utils/billing';
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
    subscription.categories.errors = MetricHistoryFixture({
      usage: 26,
    });
    render(
      <UsageTotals
        category={DataCategory.ERRORS}
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
    am2Subscription.categories.transactions = MetricHistoryFixture({
      usage: 26,
    });
    SubscriptionStore.set(organization.slug, am2Subscription);
    render(
      <UsageTotals
        showEventBreakdown
        category={DataCategory.TRANSACTIONS}
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

  it('renders continuous profiling totals', async function () {
    subscription.categories.profileDuration = MetricHistoryFixture({
      usage: 15 * MILLISECONDS_IN_HOUR,
    });
    const profileDurationTotals = UsageTotalFixture({
      accepted: 15 * MILLISECONDS_IN_HOUR,
      dropped: 0,
      droppedOverQuota: 0,
      droppedSpikeProtection: 0,
      droppedOther: 0,
    });

    const profileChunksTotals = UsageTotalFixture({
      accepted: 0,
      dropped: 5 * MILLISECONDS_IN_HOUR,
      droppedOverQuota: 0,
      droppedSpikeProtection: 0,
      droppedOther: 0,
    });

    const profilesTotals = UsageTotalFixture({
      accepted: 0,
      dropped: 5 * MILLISECONDS_IN_HOUR,
      droppedOverQuota: 0,
      droppedSpikeProtection: 0,
      droppedOther: 0,
    });

    render(
      <UsageTotals
        category={DataCategory.PROFILE_DURATION}
        totals={profileDurationTotals}
        eventTotals={{profileChunks: profileChunksTotals, profiles: profilesTotals}}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(
      screen.getByText('Continuous profile hours usage this period')
    ).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();

    // Expand usage table
    await userEvent.click(screen.getByRole('button'));

    expect(
      screen.getByRole('row', {
        name: 'Continuous Profile Hours Quantity % of Continuous Profile Hours',
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Accepted 15 60%'})).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Total Dropped (estimated) 10 40%'})
    ).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Over Quota 0 0%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Spike Protection 0 0%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Other 0 0%'})).toBeInTheDocument();
  });

  it('does not include profiles for estimates on non-AM3 plans', async function () {
    const profileDurationTotals = UsageTotalFixture({
      accepted: 15 * MILLISECONDS_IN_HOUR,
      dropped: 0,
      droppedOverQuota: 0,
      droppedSpikeProtection: 0,
      droppedOther: 0,
    });

    const profileChunksTotals = UsageTotalFixture({
      accepted: 0,
      dropped: 5 * MILLISECONDS_IN_HOUR,
      droppedOverQuota: 0,
      droppedSpikeProtection: 0,
      droppedOther: 0,
    });

    const profilesTotals = UsageTotalFixture({
      accepted: 0,
      dropped: 5 * MILLISECONDS_IN_HOUR,
      droppedOverQuota: 0,
      droppedSpikeProtection: 0,
      droppedOther: 0,
    });

    const am2Subscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
    });
    SubscriptionStore.set(organization.slug, am2Subscription);
    am2Subscription.categories.profileDuration = MetricHistoryFixture({
      usage: 15 * MILLISECONDS_IN_HOUR,
    });

    render(
      <UsageTotals
        category={DataCategory.PROFILE_DURATION}
        totals={profileDurationTotals}
        eventTotals={{profileChunks: profileChunksTotals, profiles: profilesTotals}}
        subscription={am2Subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(
      screen.getByText('Continuous profile hours usage this period')
    ).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();

    // Expand usage table
    await userEvent.click(screen.getByRole('button'));

    expect(
      screen.getByRole('row', {
        name: 'Continuous Profile Hours Quantity % of Continuous Profile Hours',
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Accepted 15 75%'})).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Total Dropped (estimated) 5 25%'})
    ).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Over Quota 0 0%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Spike Protection 0 0%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Other 0 0%'})).toBeInTheDocument();
  });

  it('does not render transaction event totals without feature', async function () {
    const am2Subscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
    });
    am2Subscription.categories.transactions = MetricHistoryFixture({
      usage: 26,
    });
    SubscriptionStore.set(organization.slug, am2Subscription);
    render(
      <UsageTotals
        category={DataCategory.TRANSACTIONS}
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
        category={DataCategory.SPANS}
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
        allTotalsByCategory={{
          spans: totals,
          spansIndexed: totals,
        }}
      />
    );

    expect(screen.getByText('Spans spend this period')).toBeInTheDocument();
    expect(screen.getByTestId('reserved-spans')).toHaveTextContent(
      '$100,000.00 Reserved'
    );
    expect(screen.getByText('$60,000')).toBeInTheDocument();
    expect(screen.getByText('40% of $100,000')).toBeInTheDocument();

    // Expand usage table
    await userEvent.click(screen.getByRole('button'));

    expect(
      screen.getByRole('row', {name: 'Accepted Spans Quantity % of Accepted Spans'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Accepted Spans'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Stored Spans'})).toBeInTheDocument();
  });

  it('renders spans with reserved budgets without dynamic sampling', async function () {
    const dsSubscription = Am3DsEnterpriseSubscriptionFixture({
      organization,
      hadCustomDynamicSampling: false,
    });
    render(
      <UsageTotals
        showEventBreakdown
        category={DataCategory.SPANS}
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
        category={DataCategory.SPANS}
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
        allTotalsByCategory={{
          spans: totals,
          spansIndexed: totals,
        }}
      />
    );

    expect(screen.getByTestId('gifted-spans')).toHaveTextContent(
      '$100,000.00 Reserved + $10,000.00 Gifted'
    );
    expect(
      screen.getByText('Accepted Spans Included in Subscription')
    ).toBeInTheDocument();
    expect(screen.getByText('40% of $110,000')).toBeInTheDocument();
    expect(screen.getByText('Stored Spans Included in Subscription')).toBeInTheDocument();
    expect(screen.getByText('20% of $110,000')).toBeInTheDocument();
  });

  it('renders reserved budget categories with soft cap', function () {
    const dsSubscription = Am3DsEnterpriseSubscriptionFixture({
      organization,
      hadCustomDynamicSampling: true,
    });
    render(
      <UsageTotals
        category={DataCategory.SPANS}
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
    subscription.categories.attachments = MetricHistoryFixture({
      usage: 26,
    });
    render(
      <UsageTotals
        category={DataCategory.ATTACHMENTS}
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
    subscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
    });
    render(
      <UsageTotals
        category={DataCategory.TRANSACTIONS}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByText('Performance units usage this period')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders gifted errors', function () {
    subscription.categories.errors = MetricHistoryFixture({usage: 175_000});
    render(
      <UsageTotals
        category={DataCategory.ERRORS}
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
    subscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
    });
    subscription.categories.transactions = MetricHistoryFixture({});
    render(
      <UsageTotals
        category={DataCategory.TRANSACTIONS}
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
    subscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
    });
    subscription.categories.transactions = MetricHistoryFixture({});
    render(
      <UsageTotals
        category={DataCategory.TRANSACTIONS}
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
        category={DataCategory.ATTACHMENTS}
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
    subscription.categories.attachments = MetricHistoryFixture({
      usage: GIGABYTE * 0.6,
    });
    const attachments = UsageTotalFixture({accepted: GIGABYTE * 0.6});
    render(
      <UsageTotals
        category={DataCategory.ATTACHMENTS}
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
    subscription.categories.errors = MetricHistoryFixture({
      usage: 92_400,
    });
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
    subscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
    });
    const transactions = UsageTotalFixture({accepted: 200_000});
    subscription.categories.transactions = MetricHistoryFixture({
      usage: 200_000,
    });
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
        category={DataCategory.ERRORS}
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
        category={DataCategory.ERRORS}
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
        category={DataCategory.ERRORS}
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
        category={DataCategory.ERRORS}
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
        category={DataCategory.ERRORS}
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
        category={DataCategory.ERRORS}
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
        category={DataCategory.REPLAYS}
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
        category={DataCategory.REPLAYS}
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
        category={DataCategory.REPLAYS}
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
      usage: prepaidUsage,
    });
    const spendTotals = UsageTotalFixture({
      accepted: prepaidUsage,
      dropped: 100_000,
    });
    render(
      <UsageTotals
        category={DataCategory.ERRORS}
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
      usage: prepaidUsage,
    });
    const spendTotals = UsageTotalFixture({
      accepted: prepaidUsage,
      dropped: 100_000,
    });
    render(
      <UsageTotals
        category={DataCategory.ERRORS}
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
    subscription.categories.errors = MetricHistoryFixture({
      usage: 26,
    });
    render(
      <UsageTotals
        category={DataCategory.ERRORS}
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
        category={DataCategory.ERRORS}
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
        category={DataCategory.ERRORS}
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
      usage: 150_000,
    });

    render(
      <UsageTotals
        category={DataCategory.ERRORS}
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
      usage: 100_000,
    });

    render(
      <UsageTotals
        category={DataCategory.ERRORS}
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

  it('renders gifted hours for profile duration when gifted present', function () {
    render(
      <UsageTotals
        category={DataCategory.PROFILE_DURATION}
        totals={UsageTotalFixture({accepted: 15 * MILLISECONDS_IN_HOUR})}
        reservedUnits={null}
        freeUnits={50}
        prepaidUnits={150}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('gifted-profileDuration')).toHaveTextContent('50 Gifted');
    expect(screen.getByTestId('gifted-profileDuration')).not.toHaveTextContent(
      '0 Reserved'
    );
  });

  it('renders gifted hours for profile duration ui when gifted present', function () {
    render(
      <UsageTotals
        category={DataCategory.PROFILE_DURATION_UI}
        totals={UsageTotalFixture({accepted: 15 * MILLISECONDS_IN_HOUR})}
        reservedUnits={null}
        freeUnits={50}
        prepaidUnits={150}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('gifted-profileDurationUI')).toHaveTextContent('50 Gifted');
    expect(screen.getByTestId('gifted-profileDurationUI')).not.toHaveTextContent(
      '0 Reserved'
    );
  });

  it('renders reserved budget quota with gifted budget when both present', function () {
    render(
      <UsageTotals
        category={DataCategory.SPANS}
        totals={UsageTotalFixture({accepted: 100})}
        reservedUnits={RESERVED_BUDGET_QUOTA}
        prepaidUnits={RESERVED_BUDGET_QUOTA}
        reservedBudget={100_000_00}
        freeBudget={10_000_00}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('gifted-spans')).toHaveTextContent(
      '$100,000.00 Reserved + $10,000.00 Gifted'
    );
  });

  it('shows both Seer category tables when expanded during active trial', async function () {
    subscription.productTrials = [
      {
        category: DataCategory.SEER_AUTOFIX,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(10, 'days').format(),
        endDate: moment().utc().add(20, 'days').format(),
      },
    ];

    // Add both Seer categories to subscription
    subscription.categories.seerAutofix = MetricHistoryFixture({
      usage: 10,
      category: DataCategory.SEER_AUTOFIX,
    });
    subscription.categories.seerScanner = MetricHistoryFixture({
      usage: 15,
      category: DataCategory.SEER_SCANNER,
    });

    const seerAutofixTotals = UsageTotalFixture({
      accepted: 10,
      dropped: 2,
    });

    const allTotalsByCategory = {
      [DataCategory.SEER_AUTOFIX]: seerAutofixTotals,
      [DataCategory.SEER_SCANNER]: UsageTotalFixture({
        accepted: 15,
        dropped: 3,
      }),
    };

    render(
      <UsageTotals
        category={DataCategory.SEER_AUTOFIX}
        totals={seerAutofixTotals}
        allTotalsByCategory={allTotalsByCategory}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByText('Seer')).toBeInTheDocument();
    expect(screen.getByText('20 days left')).toBeInTheDocument(); // Trial tag should be present

    // Expand usage table
    await userEvent.click(screen.getByTestId('expand-usage-totals-seerAutofix'));

    // Should show both Seer category tables
    expect(
      screen.getByRole('row', {name: 'Issue Fixes Quantity % of Issue Fixes'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Issue Scans Quantity % of Issue Scans'})
    ).toBeInTheDocument();

    // Verify the content of both tables
    expect(screen.getByRole('row', {name: 'Accepted 10 83%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Accepted 15 83%'})).toBeInTheDocument();
  });

  describe('Seer card element visibility', function () {
    it('shows Enable Seer button and descriptive text when Seer is not enabled and no trial exists', function () {
      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 0})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show Seer title
      expect(screen.getByText('Seer')).toBeInTheDocument();

      // Should show descriptive text
      expect(
        screen.getByText('Detect and fix issues faster with our AI debugging agent.')
      ).toBeInTheDocument();

      // Should show Enable Seer button
      expect(screen.getByText('Enable Seer')).toBeInTheDocument();

      // Should NOT show usage information
      expect(screen.queryByText('usage this period')).not.toBeInTheDocument();
      expect(screen.queryByText('trial usage this period')).not.toBeInTheDocument();

      // Should NOT show Start trial button
      expect(screen.queryByText('Start trial')).not.toBeInTheDocument();

      // Should NOT show Manage button
      expect(screen.queryByText('Manage')).not.toBeInTheDocument();

      // Should NOT show expand button
      expect(screen.queryByLabelText('Expand usage totals')).not.toBeInTheDocument();
    });

    it('shows Start trial button when potential trial exists', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: false,
          reasonCode: 1001,
          startDate: undefined,
          endDate: moment().utc().add(30, 'days').format(),
        },
      ];

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 0})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show Seer title
      expect(screen.getByText('Seer')).toBeInTheDocument();

      // Should show Start trial button
      expect(screen.getByText('Start trial')).toBeInTheDocument();

      // Should NOT show Enable Seer button
      expect(screen.queryByText('Enable Seer')).not.toBeInTheDocument();

      // Should NOT show Manage button
      expect(screen.queryByText('Manage')).not.toBeInTheDocument();

      // Should NOT show usage information (Seer card title is always empty)
      expect(screen.queryByText('usage this period')).not.toBeInTheDocument();
      expect(screen.queryByText('trial usage this period')).not.toBeInTheDocument();
    });

    it('shows usage information and trial tag during active trial', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(5, 'days').format(),
          endDate: moment().utc().add(25, 'days').format(),
        },
      ];

      subscription.categories.seerAutofix = MetricHistoryFixture({
        usage: 50,
      });

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 50})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show Seer title
      expect(screen.getByText('Seer')).toBeInTheDocument();

      // Should NOT show "trial usage this period" (Seer card title is always empty space)
      expect(screen.queryByText('trial usage this period')).not.toBeInTheDocument();

      // Should show trial tag
      expect(screen.getByText('25 days left')).toBeInTheDocument();

      // Should show usage count
      expect(screen.getByText('50')).toBeInTheDocument();

      // Should show unlimited reserved info
      expect(screen.getByText('∞')).toBeInTheDocument();

      // Should show expand button (activeTrial means !showManageButton)
      expect(screen.getByLabelText('Expand usage totals')).toBeInTheDocument();

      // Should NOT show any buttons
      expect(screen.queryByText('Enable Seer')).not.toBeInTheDocument();
      expect(screen.queryByText('Start trial')).not.toBeInTheDocument();
      expect(screen.queryByText('Manage')).not.toBeInTheDocument();

      // Should NOT show descriptive text (only shows when !hasSeer && !activeTrial)
      expect(
        screen.queryByText('Detect and fix issues faster with our AI debugging agent.')
      ).not.toBeInTheDocument();
    });

    it('shows feature prompt bar when trial has expired', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(35, 'days').format(),
          endDate: moment().utc().subtract(5, 'days').format(),
        },
      ];

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 0})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show Seer title
      expect(screen.getByText('Seer')).toBeInTheDocument();

      // Should show feature prompt bar with trial text
      expect(screen.getByText('Enable Seer to view usage')).toBeInTheDocument();

      // Should NOT show usage information (Seer card title is always empty)
      expect(screen.queryByText('usage this period')).not.toBeInTheDocument();
      expect(screen.queryByText('trial usage this period')).not.toBeInTheDocument();

      // Should show Enable Seer button (showManageButton is true for expired trial with no hasSeer)
      expect(screen.getByText('Enable Seer')).toBeInTheDocument();

      // Should NOT show these buttons
      expect(screen.queryByText('Start trial')).not.toBeInTheDocument();
      expect(screen.queryByText('Manage')).not.toBeInTheDocument();

      // Should NOT show expand button (showManageButton is true)
      expect(screen.queryByLabelText('Expand usage totals')).not.toBeInTheDocument();
    });

    it('shows feature prompt bar when potential trial exists but has expired', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: false,
          reasonCode: 1001,
          startDate: undefined,
          endDate: moment().utc().subtract(5, 'days').format(),
        },
      ];

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 0})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show Seer title
      expect(screen.getByText('Seer')).toBeInTheDocument();

      // Should show feature prompt bar (expired potential trial means showSeerPromptBar is true)
      expect(screen.getByText('Enable Seer to view usage')).toBeInTheDocument();

      // Should NOT show usage information (Seer card title is always empty)
      expect(screen.queryByText('usage this period')).not.toBeInTheDocument();
      expect(screen.queryByText('trial usage this period')).not.toBeInTheDocument();

      // Should show Enable Seer button (showManageButton is true)
      expect(screen.getByText('Enable Seer')).toBeInTheDocument();

      // Should NOT show these buttons
      expect(screen.queryByText('Start trial')).not.toBeInTheDocument();
      expect(screen.queryByText('Manage')).not.toBeInTheDocument();

      // Should NOT show expand button (showManageButton is true)
      expect(screen.queryByLabelText('Expand usage totals')).not.toBeInTheDocument();
    });

    it('shows Manage button and usage when Seer is enabled with reserved budget', function () {
      // Add a reserved budget for Seer
      subscription.reservedBudgets = [SeerReservedBudgetFixture({})];

      subscription.categories.seerAutofix = MetricHistoryFixture({
        usage: 100,
      });

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 100})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show Seer title
      expect(screen.getByText('Seer')).toBeInTheDocument();

      // Should NOT show "usage this period" (Seer card title is always empty)
      expect(screen.queryByText('usage this period')).not.toBeInTheDocument();

      // Should show usage count
      expect(screen.getByText('100')).toBeInTheDocument();

      // Should show expand button (hasSeer means !showManageButton)
      expect(screen.getByLabelText('Expand usage totals')).toBeInTheDocument();

      // Should NOT show Enable Seer button
      expect(screen.queryByText('Enable Seer')).not.toBeInTheDocument();

      // Should NOT show Start trial button
      expect(screen.queryByText('Start trial')).not.toBeInTheDocument();

      // Should NOT show descriptive text (only shows when !hasSeer && !activeTrial)
      expect(
        screen.queryByText('Detect and fix issues faster with our AI debugging agent.')
      ).not.toBeInTheDocument();

      // Should NOT show feature prompt bar (hasSeer is true)
      expect(screen.queryByText('Enable Seer to view usage')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Start your Seer trial to view usage')
      ).not.toBeInTheDocument();
    });

    it('shows correct reserved budget information when Seer is enabled', function () {
      subscription.reservedBudgets = [SeerReservedBudgetFixture({})];

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 100})}
          reservedUnits={RESERVED_BUDGET_QUOTA}
          prepaidUnits={RESERVED_BUDGET_QUOTA}
          reservedBudget={100000}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show reserved budget amount
      expect(screen.getByTestId('reserved-seerAutofix')).toHaveTextContent(
        '$1,000.00 Reserved'
      );

      // Should show Manage button with correct icon
      const manageButton = screen.getByText('Manage');
      expect(manageButton).toBeInTheDocument();
    });

    it('does not show usage bars or expand button when Seer is not enabled or in trial', function () {
      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 0})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should NOT show usage bar container
      expect(
        screen.queryByTestId('usage-bar-container-seerAutofix')
      ).not.toBeInTheDocument();

      // Should NOT show expand button
      expect(screen.queryByLabelText('Expand usage totals')).not.toBeInTheDocument();

      // Should NOT show usage totals in legend
      expect(screen.queryByText('Total Usage')).not.toBeInTheDocument();
      expect(screen.queryByText('Included in Subscription')).not.toBeInTheDocument();
    });

    it('shows usage bars and expand button during active trial', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(5, 'days').format(),
          endDate: moment().utc().add(25, 'days').format(),
        },
      ];

      subscription.categories.seerAutofix = MetricHistoryFixture({
        usage: 50,
      });

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 50})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show usage bar container
      expect(screen.getByTestId('usage-bar-container-seerAutofix')).toBeInTheDocument();

      // Should show expand button
      expect(screen.getByLabelText('Expand usage totals')).toBeInTheDocument();

      // Should show usage totals in legend
      expect(screen.getByText('Total Usage')).toBeInTheDocument();
    });

    it('shows correct button text based on Seer state for both SEER_AUTOFIX and SEER_SCANNER categories', function () {
      // Test SEER_SCANNER without Seer enabled
      render(
        <UsageTotals
          category={DataCategory.SEER_SCANNER}
          totals={UsageTotalFixture({accepted: 0})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      expect(screen.getByText('Enable Seer')).toBeInTheDocument();

      // Test SEER_SCANNER with Seer enabled
      subscription.reservedBudgets = [SeerReservedBudgetFixture({})];

      render(
        <UsageTotals
          category={DataCategory.SEER_SCANNER}
          totals={UsageTotalFixture({accepted: 50})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      expect(screen.getByText('Manage')).toBeInTheDocument();
    });

    it('shows trial prompt bar when potential trial exists and is not started', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: false,
          reasonCode: 1001,
          startDate: undefined,
          endDate: moment().utc().add(30, 'days').format(),
        },
      ];

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 0})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show feature prompt bar with trial text
      expect(screen.getByText('Start your Seer trial to view usage')).toBeInTheDocument();

      // Should show Start trial button
      expect(screen.getByText('Start trial')).toBeInTheDocument();

      // Should NOT show Enable Seer button
      expect(screen.queryByText('Enable Seer')).not.toBeInTheDocument();
    });

    it('shows correct icon for Enable Seer button when Seer is not enabled', function () {
      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 0})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      const enableButton = screen.getByText('Enable Seer');
      expect(enableButton).toBeInTheDocument();

      // Check that the button has the lock icon (IconLock)
      const lockIcon = enableButton.parentElement?.querySelector('svg');
      expect(lockIcon).toBeInTheDocument();
    });

    it('shows correct icon for Manage button when Seer is enabled', function () {
      subscription.reservedBudgets = [SeerReservedBudgetFixture({})];

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 100})}
          reservedUnits={RESERVED_BUDGET_QUOTA}
          prepaidUnits={RESERVED_BUDGET_QUOTA}
          reservedBudget={100000}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      const manageButton = screen.getByText('Manage');
      expect(manageButton).toBeInTheDocument();

      // Check that the button has the open icon (IconOpen)
      const openIcon = manageButton.parentElement?.querySelector('svg');
      expect(openIcon).toBeInTheDocument();
    });

    it('handles trial ending exactly today', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(30, 'days').format(),
          endDate: moment().utc().format(), // Ends today
        },
      ];

      subscription.categories.seerAutofix = MetricHistoryFixture({
        usage: 50,
      });

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 50})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show trial tag with "0 days left" or similar
      expect(screen.getByText('0 days left')).toBeInTheDocument();

      // Should still show usage during trial
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('∞')).toBeInTheDocument();
    });

    it('shows unlimited reserved during active trial regardless of reserved budget', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(5, 'days').format(),
          endDate: moment().utc().add(25, 'days').format(),
        },
      ];

      // Even with a reserved budget, during trial it should show unlimited
      subscription.reservedBudgets = [SeerReservedBudgetFixture({})];
      subscription.categories.seerAutofix = MetricHistoryFixture({
        usage: 50,
      });

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 50})}
          reservedUnits={RESERVED_BUDGET_QUOTA}
          prepaidUnits={RESERVED_BUDGET_QUOTA}
          reservedBudget={100000}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show unlimited symbol during trial
      expect(screen.getByText('∞')).toBeInTheDocument();

      // Should NOT show the reserved budget amount during trial
      expect(screen.queryByText('$1,000.00 Reserved')).not.toBeInTheDocument();
    });

    it('handles mixed trial states between SEER_AUTOFIX and SEER_SCANNER', function () {
      // Only SEER_AUTOFIX has an active trial
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(5, 'days').format(),
          endDate: moment().utc().add(25, 'days').format(),
        },
      ];

      subscription.categories.seerScanner = MetricHistoryFixture({
        usage: 0,
      });

      render(
        <UsageTotals
          category={DataCategory.SEER_SCANNER}
          totals={UsageTotalFixture({accepted: 0})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // SEER_SCANNER should not show trial info since its trial is not active
      expect(screen.queryByText('days left')).not.toBeInTheDocument();

      // Should show Enable Seer button (no trial for this category)
      expect(screen.getByText('Enable Seer')).toBeInTheDocument();

      // Should show descriptive text
      expect(
        screen.getByText('Detect and fix issues faster with our AI debugging agent.')
      ).toBeInTheDocument();
    });

    it('shows correct checkout URL for Enable Seer button', function () {
      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 0})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      const enableButton = screen.getByText('Enable Seer');
      expect(enableButton.closest('a')).toHaveAttribute(
        'href',
        '/settings/billing/checkout/?referrer=manage_subscription'
      );
    });

    it('shows correct checkout URL for Manage button when Seer is enabled', function () {
      subscription.reservedBudgets = [SeerReservedBudgetFixture({})];

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 100})}
          reservedUnits={RESERVED_BUDGET_QUOTA}
          prepaidUnits={RESERVED_BUDGET_QUOTA}
          reservedBudget={100000}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      const manageButton = screen.getByText('Manage');
      expect(manageButton.closest('a')).toHaveAttribute(
        'href',
        '/settings/billing/checkout/?referrer=manage_subscription'
      );
    });

    it('handles zero usage during active trial', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(5, 'days').format(),
          endDate: moment().utc().add(25, 'days').format(),
        },
      ];

      subscription.categories.seerAutofix = MetricHistoryFixture({
        usage: 0,
      });

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 0})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show trial tag
      expect(screen.getByText('25 days left')).toBeInTheDocument();

      // Should show zero usage
      expect(screen.getByText('0')).toBeInTheDocument();

      // Should show unlimited reserved info
      expect(screen.getByText('∞')).toBeInTheDocument();

      expect(screen.getByTestId('usage-bar-container-seerAutofix')).toBeInTheDocument();
    });

    it('handles high usage during active trial', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(5, 'days').format(),
          endDate: moment().utc().add(25, 'days').format(),
        },
      ];

      subscription.categories.seerAutofix = MetricHistoryFixture({
        usage: 1_000_000,
      });

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 1_000_000})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show trial tag
      expect(screen.getByText('25 days left')).toBeInTheDocument();

      // Should show formatted high usage
      expect(screen.getByText('1,000,000')).toBeInTheDocument();

      // Should show unlimited reserved info (no limits during trial)
      expect(screen.getByText('∞')).toBeInTheDocument();
    });

    it('handles potential trial with different reason codes', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: false,
          reasonCode: 2001, // Different reason code
          startDate: undefined,
          endDate: moment().utc().add(30, 'days').format(),
        },
      ];

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 0})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should still show Start trial button regardless of reason code
      expect(screen.getByText('Start trial')).toBeInTheDocument();

      // Should show trial prompt bar
      expect(screen.getByText('Start your Seer trial to view usage')).toBeInTheDocument();
    });

    it('handles trial button busy state', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: false,
          reasonCode: 1001,
          startDate: undefined,
          endDate: moment().utc().add(30, 'days').format(),
        },
      ];

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 0})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Find the button by its test ID instead of text content
      const startTrialButton = screen.getByTestId('start-trial-button');
      expect(startTrialButton).toBeInTheDocument();
      expect(startTrialButton).toBeEnabled();
      expect(startTrialButton).toHaveTextContent('Start trial');

      // The button should have proper aria-label (StartTrialButton component sets this)
      expect(startTrialButton).toHaveAttribute('aria-label', 'Start trial');
    });

    it('handles Seer with gifted budget in addition to reserved budget', function () {
      subscription.reservedBudgets = [SeerReservedBudgetFixture({})];

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 100})}
          reservedUnits={RESERVED_BUDGET_QUOTA}
          prepaidUnits={RESERVED_BUDGET_QUOTA}
          reservedBudget={100000}
          freeBudget={10000} // Gifted budget
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show both reserved and gifted budget
      expect(screen.getByTestId('gifted-seerAutofix')).toHaveTextContent(
        '$1,000.00 Reserved + $100.00 Gifted'
      );
    });

    it('handles Seer card in spend mode during trial', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(5, 'days').format(),
          endDate: moment().utc().add(25, 'days').format(),
        },
      ];

      subscription.categories.seerAutofix = MetricHistoryFixture({
        usage: 50,
      });

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 50})}
          subscription={subscription}
          organization={organization}
          displayMode="cost" // Cost mode during trial
        />
      );

      // Should show trial tag
      expect(screen.getByText('25 days left')).toBeInTheDocument();

      // Should show cost in spend mode
      expect(screen.getByText('$0')).toBeInTheDocument();

      // Should show unlimited during trial regardless of display mode
      expect(screen.getByText('∞')).toBeInTheDocument();
    });

    it('handles Seer card when both categories have different trial states', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(5, 'days').format(),
          endDate: moment().utc().add(25, 'days').format(),
        },
        {
          category: DataCategory.SEER_SCANNER,
          isStarted: false,
          reasonCode: 1001,
          startDate: undefined,
          endDate: moment().utc().add(30, 'days').format(),
        },
      ];

      // Test SEER_AUTOFIX with active trial
      subscription.categories.seerAutofix = MetricHistoryFixture({
        usage: 50,
      });

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 50})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show active trial state for SEER_AUTOFIX
      expect(screen.getByText('25 days left')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('∞')).toBeInTheDocument();
    });

    it('handles Seer card with very long trial duration', function () {
      subscription.productTrials = [
        {
          category: DataCategory.SEER_AUTOFIX,
          isStarted: true,
          reasonCode: 1001,
          startDate: moment().utc().subtract(5, 'days').format(),
          endDate: moment().utc().add(365, 'days').format(), // Very long trial
        },
      ];

      subscription.categories.seerAutofix = MetricHistoryFixture({
        usage: 50,
      });

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 50})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should show trial tag with correct days
      expect(screen.getByText('365 days left')).toBeInTheDocument();

      // Should show unlimited during trial
      expect(screen.getByText('∞')).toBeInTheDocument();
    });

    it('handles Seer card when subscription has no categories', function () {
      // Remove Seer categories from subscription
      delete subscription.categories.seerAutofix;
      delete subscription.categories.seerScanner;

      render(
        <UsageTotals
          category={DataCategory.SEER_AUTOFIX}
          totals={UsageTotalFixture({accepted: 0})}
          subscription={subscription}
          organization={organization}
          displayMode="usage"
        />
      );

      // Should still show Seer title
      expect(screen.getByText('Seer')).toBeInTheDocument();

      // Should show Enable Seer button
      expect(screen.getByText('Enable Seer')).toBeInTheDocument();

      // Should show descriptive text
      expect(
        screen.getByText('Detect and fix issues faster with our AI debugging agent.')
      ).toBeInTheDocument();
    });
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
      usage: prepaidUsage,
    });
    expect(
      calculateCategoryPrepaidUsage(DataCategory.ERRORS, subscription, prepaid)
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
    subscription.categories.errors = MetricHistoryFixture({});
    expect(
      calculateCategoryPrepaidUsage(DataCategory.ERRORS, subscription, prepaidPrice)
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
    subscription.categories.errors = MetricHistoryFixture({});
    expect(
      calculateCategoryPrepaidUsage(
        DataCategory.MONITOR_SEATS,
        subscription,
        prepaidPrice
      )
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
      usage: prepaidUsage,
    });
    expect(
      calculateCategoryPrepaidUsage(DataCategory.MONITOR_SEATS, subscription, prepaid)
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
    subscription.categories.errors = MetricHistoryFixture({
      reserved: prepaid,
      onDemandQuantity: 50_000,
      usage: 150_000,
    });

    const result = calculateCategoryPrepaidUsage(
      DataCategory.ERRORS,
      subscription,
      prepaid
    );

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
    subscription.categories.errors = MetricHistoryFixture({
      reserved: prepaid,
      onDemandQuantity: 0,
      usage: 80_000,
    });

    const result = calculateCategoryPrepaidUsage(
      DataCategory.ERRORS,
      subscription,
      prepaid
    );

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

    subscription.categories.errors = MetricHistoryFixture({
      reserved: prepaid,
      onDemandQuantity: 50_000,
      usage: 150_000,
    });

    const result = calculateCategoryPrepaidUsage(
      DataCategory.ERRORS,
      subscription,
      prepaid
    );

    expect(result.onDemandUsage).toBe(0);
    expect(result.prepaidUsage).toBe(150_000);
  });

  it('calculates for reserved budgets with reserved spend', function () {
    const subscription = Am3DsEnterpriseSubscriptionFixture({organization});
    const prepaid = 100_000_00;
    subscription.categories.spans = MetricHistoryFixture({
      reserved: prepaid,
      onDemandQuantity: 50_000,
      usage: 150_000,
    });

    const result = calculateCategoryPrepaidUsage(
      DataCategory.SPANS,
      subscription,
      prepaid,
      null,
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
      DataCategory.SPANS,
      subscription,
      prepaid,
      null,
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

    const result3 = calculateCategoryPrepaidUsage(
      DataCategory.SPANS,
      subscription,
      prepaid,
      null,
      undefined,
      0
    );
    expect(result3).toEqual({
      onDemandUsage: 0,
      prepaidPercentUsed: 0,
      prepaidPrice: 100_000_00,
      prepaidSpend: 0,
      prepaidUsage: 150_000,
    });
  });

  it('calculates for reserved budgets with reserved cpe', function () {
    const subscription = Am3DsEnterpriseSubscriptionFixture({organization});
    const prepaid = 100_000_00;
    subscription.categories.spans = MetricHistoryFixture({
      reserved: prepaid,
      onDemandQuantity: 50_000,
      usage: 150_000,
    });

    const result = calculateCategoryPrepaidUsage(
      DataCategory.SPANS,
      subscription,
      prepaid,
      null,
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
    expect(calculateCategoryOnDemandUsage(DataCategory.ERRORS, subscription)).toEqual({
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
    expect(calculateCategoryOnDemandUsage(DataCategory.ERRORS, subscription)).toEqual({
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
    expect(calculateCategoryOnDemandUsage(DataCategory.ERRORS, subscription)).toEqual({
      onDemandTotalAvailable: onDemandCategoryMax,
      // Half is left for other categories
      onDemandCategoryMax: onDemandCategoryMax / 2,
      onDemandCategorySpend: 0,
      ondemandPercentUsed: 0,
    });
  });
});

describe('hasReservedQuotaFunctionality', function () {
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

  it('does not render reserved quota section when reserved is null', function () {
    render(
      <UsageTotals
        category={DataCategory.ERRORS}
        totals={UsageTotalFixture({accepted: 100})}
        reservedUnits={null}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.queryByTestId('reserved-errors')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gifted-errors')).not.toBeInTheDocument();
  });

  it('renders reserved quota section when reserved is UNLIMITED_RESERVED', function () {
    render(
      <UsageTotals
        category={DataCategory.ERRORS}
        totals={UsageTotalFixture({accepted: 100})}
        reservedUnits={UNLIMITED_RESERVED}
        prepaidUnits={UNLIMITED_RESERVED}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('reserved-errors')).toHaveTextContent('∞ Reserved');
  });

  it('renders reserved quota section when reserved is greater than 0', function () {
    render(
      <UsageTotals
        category={DataCategory.ERRORS}
        totals={UsageTotalFixture({accepted: 100})}
        reservedUnits={100_000}
        prepaidUnits={100_000}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('reserved-errors')).toHaveTextContent('100K Reserved');
  });

  it('renders reserved quota with gifted amount when both present', function () {
    render(
      <UsageTotals
        category={DataCategory.ERRORS}
        totals={UsageTotalFixture({accepted: 100})}
        reservedUnits={100_000}
        freeUnits={50_000}
        prepaidUnits={150_000}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('gifted-errors')).toHaveTextContent(
      '100K Reserved + 50K Gifted'
    );
  });

  it('renders reserved budget quota when using budget-based reserved', function () {
    render(
      <UsageTotals
        category={DataCategory.SPANS}
        totals={UsageTotalFixture({accepted: 100})}
        reservedUnits={RESERVED_BUDGET_QUOTA}
        prepaidUnits={RESERVED_BUDGET_QUOTA}
        reservedBudget={100_000_00}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('reserved-spans')).toHaveTextContent(
      '$100,000.00 Reserved'
    );
  });

  it('renders reserved budget quota with gifted budget when both present', function () {
    render(
      <UsageTotals
        category={DataCategory.SPANS}
        totals={UsageTotalFixture({accepted: 100})}
        reservedUnits={RESERVED_BUDGET_QUOTA}
        prepaidUnits={RESERVED_BUDGET_QUOTA}
        reservedBudget={100_000_00}
        freeBudget={10_000_00}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('gifted-spans')).toHaveTextContent(
      '$100,000.00 Reserved + $10,000.00 Gifted'
    );
  });
});

describe('Usage Bar Rendering', function () {
  const organization = OrganizationFixture();
  let subscription: Subscription;

  beforeEach(() => {
    subscription = SubscriptionFixture({
      organization,
      plan: 'am3_business',
      isTrial: false,
    });
    // Mock basic category info
    subscription.categories.errors = MetricHistoryFixture({usage: 0});
    SubscriptionStore.set(organization.slug, subscription);
  });

  afterEach(() => {
    SubscriptionStore.init();
  });

  it('renders 100% unused width when reserved is 0 and not a trial', function () {
    subscription.categories.errors = MetricHistoryFixture({usage: 0});
    render(
      <UsageTotals
        category={DataCategory.ERRORS}
        totals={UsageTotalFixture({accepted: 0})}
        reservedUnits={0}
        prepaidUnits={0} // No prepaid units if reserved is 0
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('usage-card-errors')).toBeInTheDocument();

    const usageBarContainer = screen.getByTestId('usage-bar-container-errors');
    expect(usageBarContainer).toBeInTheDocument();

    const firstGroupBars = usageBarContainer?.querySelectorAll(
      '[class*="PlanUseBarGroup"]:first-of-type > [class*="PlanUseBar"]'
    );
    // Should only be one bar (the unused bar)
    expect(firstGroupBars).toHaveLength(1);
    expect(firstGroupBars?.[0]).toHaveStyle({width: '100%'});
  });

  it('renders correct unused width when reserved is non-zero and not a trial (50% usage)', function () {
    const reserved = 100_000;
    const usage = reserved / 2;
    subscription.categories.errors = MetricHistoryFixture({usage});

    render(
      <UsageTotals
        category={DataCategory.ERRORS}
        totals={UsageTotalFixture({accepted: usage})}
        reservedUnits={reserved}
        prepaidUnits={reserved} // Prepaid matches reserved
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('usage-card-errors')).toBeInTheDocument();

    const usageBarContainer = screen.getByTestId('usage-bar-container-errors');
    expect(usageBarContainer).toBeInTheDocument();

    const firstGroupBars = usageBarContainer?.querySelectorAll(
      '[class*="PlanUseBarGroup"]:first-of-type > [class*="PlanUseBar"]'
    );
    // Should be two bars (used + unused)
    expect(firstGroupBars).toHaveLength(2);
    expect(firstGroupBars?.[0]).toHaveStyle({width: '50%'}); // Used bar
    expect(firstGroupBars?.[1]).toHaveStyle({width: '50%'}); // Unused bar
  });

  it('renders correct unused width when reserved is 0 but is a trial (0% usage)', function () {
    subscription.isTrial = true;
    subscription.categories.errors = MetricHistoryFixture({usage: 0});

    render(
      <UsageTotals
        category={DataCategory.ERRORS}
        totals={UsageTotalFixture({accepted: 0})}
        reservedUnits={0} // Reserved is 0
        prepaidUnits={0} // Assume trial gives some implicit quota, or calculation handles 0
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('usage-card-errors')).toBeInTheDocument();

    const usageBarContainer = screen.getByTestId('usage-bar-container-errors');
    expect(usageBarContainer).toBeInTheDocument();

    const firstGroupBars = usageBarContainer?.querySelectorAll(
      '[class*="PlanUseBarGroup"]:first-of-type > [class*="PlanUseBar"]'
    );
    // Should only be one bar (unused, calculated as 100 - 0%)
    expect(firstGroupBars).toHaveLength(1);
    expect(firstGroupBars?.[0]).toHaveStyle({width: '100%'});
  });

  it('renders correct unused width when reserved is 0 but is a trial (50% usage)', function () {
    subscription.isTrial = true;
    const trialQuota = 100_000; // Assume trial provides some implicit quota used for % calculation
    const usage = trialQuota / 2;
    subscription.categories.errors = MetricHistoryFixture({usage});

    render(
      <UsageTotals
        category={DataCategory.ERRORS}
        totals={UsageTotalFixture({accepted: usage})}
        reservedUnits={0} // Reserved is 0
        prepaidUnits={trialQuota} // Pass the trial quota as prepaid for calculation
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.getByTestId('usage-card-errors')).toBeInTheDocument();

    const usageBarContainer = screen.getByTestId('usage-bar-container-errors');
    expect(usageBarContainer).toBeInTheDocument();

    const firstGroupBars = usageBarContainer?.querySelectorAll(
      '[class*="PlanUseBarGroup"]:first-of-type > [class*="PlanUseBar"]'
    );
    // Should be two bars (used + unused)
    expect(firstGroupBars).toHaveLength(2);
    expect(firstGroupBars?.[0]).toHaveStyle({width: '50%'}); // Used bar
    expect(firstGroupBars?.[1]).toHaveStyle({width: '50%'}); // Unused bar (calculated as 100 - 50%)
  });
});
