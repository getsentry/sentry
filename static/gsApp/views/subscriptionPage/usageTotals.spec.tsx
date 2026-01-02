import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {
  DynamicSamplingReservedBudgetFixture,
  ReservedBudgetMetricHistoryFixture,
  SeerReservedBudgetFixture,
} from 'getsentry-test/fixtures/reservedBudget';
import {
  Am3DsEnterpriseSubscriptionFixture,
  SubscriptionFixture,
  SubscriptionWithLegacySeerFixture,
} from 'getsentry-test/fixtures/subscription';
import {UsageTotalFixture} from 'getsentry-test/fixtures/usageTotal';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import {GIGABYTE, UNLIMITED_RESERVED} from 'getsentry/constants';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {OnDemandBudgetMode, type Subscription} from 'getsentry/types';
import {MILLISECONDS_IN_HOUR} from 'getsentry/utils/billing';
import {
  calculateCategoryOnDemandUsage,
  calculateCategoryPrepaidUsage,
  CombinedUsageTotals,
  UsageTotals,
} from 'getsentry/views/subscriptionPage/usageTotals';

describe('Subscription > UsageTotals', () => {
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

  it('calculates error totals and renders them', async () => {
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

  it('renders transaction event totals with feature', async () => {
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

  it('renders continuous profiling totals', async () => {
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
    expect(
      screen.queryByRole('row', {name: 'Spike Protection 0 0%'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Other 0 0%'})).toBeInTheDocument();
  });

  it('does not include profiles for estimates on non-AM3 plans', async () => {
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
    expect(
      screen.queryByRole('row', {name: 'Spike Protection 0 0%'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Other 0 0%'})).toBeInTheDocument();
  });

  it('does not render transaction event totals without feature', async () => {
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

  it('formats units', async () => {
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

  it('renders default stats with no billing history', () => {
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

  it('renders gifted errors', () => {
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

  it('renders gifted transactions', () => {
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

  it('does not render gifted transactions with unlimited quota', () => {
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

  it('renders gifted attachments', () => {
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

  it('renders accepted percentage for attachments', () => {
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

  it('renders accepted percentage for errors', () => {
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

  it('renders accepted percentage for transactions', () => {
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

  it('renders true forward', () => {
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

  it('renders soft cap type on demand', () => {
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

  it('renders soft cap type true forward', () => {
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

  it('renders true forward with gifted amount', () => {
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

  it('renders soft cap type on demand with gifted amount', () => {
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

  it('renders soft cap type true forward with gifted amount', () => {
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

  it('renders usage card with Trial if an active trial exists', () => {
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

  it('renders usage card with Start trial button if a potential trial exists', () => {
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

  it('renders usage card as normal if trial has ended', () => {
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

  it('renders onDemandUsage when over prepaidTotal', () => {
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

  it('does not render onDemandUsage when under prepaidTotal', () => {
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

  it('renders gifted hours for profile duration when gifted present', () => {
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

  it('renders gifted hours for profile duration ui when gifted present', () => {
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
});

describe('Subscription > CombinedUsageTotals', () => {
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

  it('always renders reserved budgets in spend mode', async () => {
    const seerSubscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
      onDemandMaxSpend: 10_00,
    });
    seerSubscription.planTier = 'am3'; // TODO: fix subscription fixture to set planTier properly

    render(
      <CombinedUsageTotals
        productGroup={seerSubscription.reservedBudgets![0]!}
        subscription={seerSubscription}
        organization={organization}
        allTotalsByCategory={{
          seerAutofix: totals,
          seerScanner: totals,
        }}
      />
    );

    expect(screen.getByText('Seer')).toBeInTheDocument();
    expect(screen.getByTestId('reserved-seer')).toHaveTextContent('$25.00 Reserved');
    expect(screen.getByText('Issue Fixes Included in Subscription')).toBeInTheDocument();
    expect(screen.getByText('Pay-as-you-go Issue Fixes')).toBeInTheDocument();
    expect(screen.getByText('Issue Scans Included in Subscription')).toBeInTheDocument();
    expect(screen.getByText('Pay-as-you-go Issue Scans')).toBeInTheDocument();

    // Expand usage table
    await userEvent.click(screen.getByRole('button', {name: 'Expand usage totals'}));

    expect(
      screen.getByRole('row', {name: 'Issue Fixes Quantity % of Issue Fixes'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Issue Fixes'})).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Issue Scans Quantity % of Issue Scans'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Issue Scans'})).toBeInTheDocument();
  });

  it('uses billed usage for accepted counts in expanded table', async () => {
    const seerSubscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
      onDemandMaxSpend: 10_00,
    });
    seerSubscription.planTier = 'am3'; // TODO: fix subscription fixture to set planTier properly
    seerSubscription.categories.seerAutofix!.usage = 1;

    render(
      <CombinedUsageTotals
        productGroup={seerSubscription.reservedBudgets![0]!}
        subscription={seerSubscription}
        organization={organization}
        allTotalsByCategory={{
          seerAutofix: totals,
          seerScanner: totals,
        }}
      />
    );

    expect(screen.getByText('Seer')).toBeInTheDocument();

    // Expand usage table
    await userEvent.click(screen.getByRole('button', {name: 'Expand usage totals'}));
    expect(
      screen.getByRole('row', {name: 'Issue Fixes Quantity % of Issue Fixes'})
    ).toBeInTheDocument();
    // used accepted info from BMH, all other info from totals
    expect(screen.getByRole('row', {name: 'Accepted 1 9%'})).toBeInTheDocument();
  });

  it('shows table with dropped totals breakdown for reserved budgets', async () => {
    const seerSubscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
    });
    seerSubscription.planTier = 'am3';

    render(
      <CombinedUsageTotals
        productGroup={seerSubscription.reservedBudgets![0]!}
        subscription={seerSubscription}
        organization={organization}
        allTotalsByCategory={{
          seerAutofix: totals,
          seerScanner: totals,
        }}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Expand usage totals'}));

    const acceptedRows = screen.getAllByRole('row', {name: 'Accepted 0 0%'});
    expect(acceptedRows).toHaveLength(2);

    const totalDroppedRows = screen.getAllByRole('row', {name: 'Total Dropped 10 100%'});
    expect(totalDroppedRows).toHaveLength(2);

    const overQuotaRows = screen.getAllByRole('row', {name: 'Over Quota 7 70%'});
    expect(overQuotaRows).toHaveLength(2);

    const spikeProtectionRows = screen.queryAllByRole('row', {
      name: 'Spike Protection 1 10%',
    });
    expect(spikeProtectionRows).toHaveLength(0); // not spike protected

    const otherRows = screen.getAllByRole('row', {name: 'Other 2 20%'});
    expect(otherRows).toHaveLength(2);

    expect(screen.getByRole('columnheader', {name: 'Issue Fixes'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Issue Scans'})).toBeInTheDocument();

    const seerAutofixTable = screen.getByTestId('category-table-seerAutofix');
    const seerScannerTable = screen.getByTestId('category-table-seerScanner');

    expect(within(seerAutofixTable).getAllByRole('row')).toHaveLength(5);
    expect(within(seerScannerTable).getAllByRole('row')).toHaveLength(5);
  });

  it('renders accepted spans in spend mode with reserved budgets and dynamic sampling', async () => {
    const dsSubscription = Am3DsEnterpriseSubscriptionFixture({
      organization,
      hadCustomDynamicSampling: true,
    });
    render(
      <CombinedUsageTotals
        productGroup={
          dsSubscription.reservedBudgets?.find(b => b.apiName === 'dynamicSampling')!
        }
        subscription={dsSubscription}
        organization={organization}
        allTotalsByCategory={{
          spans: totals,
          spansIndexed: totals,
        }}
      />
    );

    expect(screen.getByText('Spans budget')).toBeInTheDocument();
    expect(screen.getByTestId('reserved-dynamicSampling')).toHaveTextContent(
      '$100,000.00 Reserved'
    );
    expect(screen.getByText('$60,000')).toBeInTheDocument();
    expect(screen.getByText('40% of $100,000')).toBeInTheDocument();
    expect(screen.getByText('20% of $100,000')).toBeInTheDocument();

    // Expand usage table
    await userEvent.click(screen.getByRole('button'));

    expect(
      screen.getByRole('row', {name: 'Accepted Spans Quantity % of Accepted Spans'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Accepted Spans'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Stored Spans Quantity % of Stored Spans'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Stored Spans'})).toBeInTheDocument();
  });

  it('renders spans with reserved budgets without dynamic sampling', async () => {
    const dsSubscription = Am3DsEnterpriseSubscriptionFixture({
      organization,
      hadCustomDynamicSampling: false,
    });
    render(
      <CombinedUsageTotals
        productGroup={
          dsSubscription.reservedBudgets?.find(b => b.apiName === 'dynamicSampling')!
        }
        subscription={dsSubscription}
        organization={organization}
        allTotalsByCategory={{
          spans: totals,
          spansIndexed: totals,
        }}
      />
    );

    expect(screen.getByText('Spans budget')).toBeInTheDocument();
    expect(screen.getByTestId('reserved-dynamicSampling')).toHaveTextContent(
      '$100,000.00 Reserved'
    );
    expect(screen.getByText('$60,000')).toBeInTheDocument();
    expect(screen.getByText('60% of $100,000')).toBeInTheDocument();

    // Expand usage table
    await userEvent.click(screen.getByRole('button', {name: 'Expand usage totals'}));

    expect(
      screen.getByRole('row', {name: 'Spans Quantity % of Spans'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Spans'})).toBeInTheDocument();
  });

  it('renders reserved budget categories with gifted budget', () => {
    const dsSubscription = Am3DsEnterpriseSubscriptionFixture({
      organization,
      hadCustomDynamicSampling: true,
    });
    dsSubscription.reservedBudgets?.forEach(b => {
      if (b.apiName === 'dynamicSampling') {
        b.freeBudget = 10_000_00;
      }
    });
    render(
      <CombinedUsageTotals
        productGroup={
          dsSubscription.reservedBudgets?.find(b => b.apiName === 'dynamicSampling')!
        }
        subscription={dsSubscription}
        organization={organization}
        allTotalsByCategory={{
          spans: totals,
          spansIndexed: totals,
        }}
      />
    );

    expect(screen.getByTestId('gifted-dynamicSampling')).toHaveTextContent(
      '$100,000.00 Reserved + $10,000.00 Gifted'
    );
    expect(
      screen.getByText('Accepted Spans Included in Subscription')
    ).toBeInTheDocument();
    expect(screen.getByText('36% of $110,000')).toBeInTheDocument();
    expect(screen.getByText('Stored Spans Included in Subscription')).toBeInTheDocument();
    expect(screen.getByText('18% of $110,000')).toBeInTheDocument();
  });

  it('renders reserved budget categories with soft cap', () => {
    const dsSubscription = Am3DsEnterpriseSubscriptionFixture({
      organization,
      hadCustomDynamicSampling: true,
    });
    render(
      <CombinedUsageTotals
        productGroup={
          dsSubscription.reservedBudgets?.find(b => b.apiName === 'dynamicSampling')!
        }
        subscription={dsSubscription}
        organization={organization}
        allTotalsByCategory={{
          spans: totals,
          spansIndexed: totals,
        }}
        softCapType="ON_DEMAND"
      />
    );

    expect(screen.getByTestId('reserved-dynamicSampling')).toHaveTextContent(
      '$100,000.00 Reserved (On Demand)'
    );
  });

  it('renders product trial upsell for customer when product is not enabled', () => {
    subscription.productTrials = [
      {
        category: DataCategory.SEER_AUTOFIX,
        isStarted: false,
        reasonCode: 1001,
        endDate: moment().utc().add(20, 'years').format(),
      },
      {
        category: DataCategory.SEER_SCANNER,
        isStarted: false,
        reasonCode: 1001,
        endDate: moment().utc().add(20, 'years').format(),
      },
    ];

    render(
      <CombinedUsageTotals
        productGroup={subscription.reservedBudgets![0]!}
        subscription={subscription}
        organization={organization}
        allTotalsByCategory={{
          seerAutofix: UsageTotalFixture({}),
          seerScanner: UsageTotalFixture({}),
        }}
      />
    );

    expect(screen.getByText('Seer')).toBeInTheDocument();
    expect(
      screen.getByText('Detect and fix issues faster with our AI debugging agent.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Issue Fixes Included in Subscription')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Pay-as-you-go Issue Fixes')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Issue Scans Included in Subscription')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Pay-as-you-go Issue Scans')).not.toBeInTheDocument();
    expect(screen.getByTestId('locked-product-message-seer')).toHaveTextContent(
      'Start your Seer trial to view usage'
    );
    expect(screen.getByText('Trial available')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Start trial'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Enable Seer'})).not.toBeInTheDocument();
  });

  it('renders enable upsell for customer when product is not enabled and trial not available', () => {
    render(
      <CombinedUsageTotals
        productGroup={subscription.reservedBudgets![0]!}
        subscription={subscription}
        organization={organization}
        allTotalsByCategory={{
          seerAutofix: UsageTotalFixture({}),
          seerScanner: UsageTotalFixture({}),
        }}
      />
    );

    expect(screen.getByText('Seer')).toBeInTheDocument();
    expect(
      screen.getByText('Detect and fix issues faster with our AI debugging agent.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Issue Fixes Included in Subscription')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Pay-as-you-go Issue Fixes')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Issue Scans Included in Subscription')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Pay-as-you-go Issue Scans')).not.toBeInTheDocument();
    expect(screen.getByTestId('locked-product-message-seer')).toHaveTextContent(
      'Enable Seer to view usage'
    );
    expect(screen.queryByText('Trial available')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Start trial'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Enable Seer'})).toBeInTheDocument();
  });

  it('renders with trial if active trial exists', () => {
    subscription.productTrials = [
      {
        category: DataCategory.SEER_AUTOFIX,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(10, 'days').format(),
        endDate: moment().utc().add(20, 'days').format(),
      },
      {
        category: DataCategory.SEER_SCANNER,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(10, 'days').format(),
        endDate: moment().utc().add(20, 'days').format(),
      },
    ];

    render(
      <CombinedUsageTotals
        productGroup={subscription.reservedBudgets![0]!}
        subscription={subscription}
        organization={organization}
        allTotalsByCategory={{
          seerAutofix: totals,
          seerScanner: UsageTotalFixture({}),
        }}
      />
    );

    expect(screen.getByText('Seer trial usage this period')).toBeInTheDocument();
    expect(screen.queryByTestId('locked-product-message-seer')).not.toBeInTheDocument();
    expect(screen.queryByText('Trial available')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Start trial'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Enable Seer'})).not.toBeInTheDocument();
  });

  it('renders contact sales upsell for managed accounts', () => {
    subscription.canSelfServe = false;

    render(
      <CombinedUsageTotals
        productGroup={subscription.reservedBudgets![0]!}
        subscription={subscription}
        organization={organization}
        allTotalsByCategory={{
          seerAutofix: UsageTotalFixture({}),
          seerScanner: UsageTotalFixture({}),
        }}
      />
    );

    expect(screen.getByText('Seer')).toBeInTheDocument();
    expect(
      screen.getByText('Detect and fix issues faster with our AI debugging agent.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('locked-product-message-seer')).toHaveTextContent(
      'Contact us at sales@sentry.io to enable Seer'
    );
    const card = screen.getByTestId('usage-card-seer');
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    expect(within(card).queryByText(/trial/)).not.toBeInTheDocument();
  });

  it('does renders card for sponsored orgs', async () => {
    const sponsoredSub = SubscriptionFixture({
      organization,
      plan: 'am2_sponsored_team_auf',
      reservedBudgets: [
        SeerReservedBudgetFixture({
          id: '1',
          reservedBudget: 20_00,
        }),
      ],
      isSponsored: true,
    });
    SubscriptionStore.set(organization.slug, sponsoredSub);
    render(
      <CombinedUsageTotals
        productGroup={sponsoredSub.reservedBudgets![0]!}
        subscription={sponsoredSub}
        organization={organization}
        allTotalsByCategory={{
          seerAutofix: UsageTotalFixture({}),
          seerScanner: UsageTotalFixture({}),
        }}
      />
    );

    expect(await screen.findByTestId('usage-card-seer')).toBeInTheDocument();
  });

  it('renders PAYG legend with per-category', () => {
    organization.features.push('ondemand-budgets');
    const seerSubscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am2_business',
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        budgets: {
          [DataCategory.SEER_AUTOFIX]: 4,
          [DataCategory.SEER_SCANNER]: 5,
        },
        usedSpends: {
          [DataCategory.SEER_AUTOFIX]: 4,
          [DataCategory.SEER_SCANNER]: 5,
        },
        enabled: true,
      },
    });
    seerSubscription.planTier = 'am2'; // TODO: fix subscription fixture to set planTier properly

    render(
      <CombinedUsageTotals
        productGroup={seerSubscription.reservedBudgets![0]!}
        subscription={seerSubscription}
        organization={organization}
        allTotalsByCategory={{
          seerAutofix: totals,
          seerScanner: totals,
        }}
      />
    );

    expect(screen.getByText('Seer')).toBeInTheDocument();
    expect(screen.getByTestId('reserved-seer')).toHaveTextContent('$25.00 Reserved');
    expect(screen.getByText('Issue Fixes Included in Subscription')).toBeInTheDocument();
    expect(screen.getByText('On-Demand Issue Fixes')).toBeInTheDocument();
    expect(screen.getByText('Issue Scans Included in Subscription')).toBeInTheDocument();
    expect(screen.getByText('On-Demand Issue Scans')).toBeInTheDocument();

    organization.features.pop();
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

  it('calculates for reserved budgets with reserved spend', () => {
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

  it('calculates for reserved budgets with reserved cpe', () => {
    const subscription = Am3DsEnterpriseSubscriptionFixture({organization});
    const prepaid = 100_000_00;
    subscription.categories.spans = MetricHistoryFixture({
      reserved: prepaid,
      onDemandQuantity: 50_000,
      usage: 150_000,
    });

    subscription.reservedBudgets = [
      DynamicSamplingReservedBudgetFixture({
        id: '11',
        reservedBudget: prepaid,
        totalReservedSpend: prepaid,
        freeBudget: 0,
        percentUsed: 1.0,
        categories: {
          spans: ReservedBudgetMetricHistoryFixture({
            reservedCpe: 100,
            reservedSpend: prepaid,
          }),
          spansIndexed: ReservedBudgetMetricHistoryFixture({
            reservedCpe: 2,
            reservedSpend: 0,
          }),
        },
      }),
    ];

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

  it('calculates for SEER reserved budgets with automatic extraction', () => {
    const subscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
    });
    const prepaid = 25_00; // $25.00 budget

    // Set up usage for seer autofix
    subscription.categories.seerAutofix = MetricHistoryFixture({
      category: DataCategory.SEER_AUTOFIX,
      reserved: prepaid,
      usage: 10, // 10 fixes used
      onDemandQuantity: 0,
    });

    // Update the reserved budget with actual spend (10 fixes * $1.00 = $10.00)
    subscription.reservedBudgets![0]!.categories[
      DataCategory.SEER_AUTOFIX
    ]!.reservedSpend = 10_00;

    const result = calculateCategoryPrepaidUsage(
      DataCategory.SEER_AUTOFIX,
      subscription,
      prepaid
    );

    expect(result).toEqual({
      onDemandUsage: 0,
      prepaidPercentUsed: 40, // 10 fixes * $1.00 = $10.00, which is 40% of $25.00
      prepaidPrice: 25_00,
      prepaidSpend: 10_00, // 40% of $25.00
      prepaidUsage: 10,
    });
  });

  it('calculates for SEER scanner with different CPE', () => {
    const subscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
    });
    const prepaid = 25_00; // $25.00 budget

    // Set up usage for seer scanner - has different CPE (1 cent vs $1.00)
    subscription.categories.seerScanner = MetricHistoryFixture({
      category: DataCategory.SEER_SCANNER,
      reserved: prepaid,
      usage: 1000, // 1000 scans used
      onDemandQuantity: 0,
    });

    // Update the reserved budget with actual spend (1000 scans * $0.01 = $10.00)
    subscription.reservedBudgets![0]!.categories[
      DataCategory.SEER_SCANNER
    ]!.reservedSpend = 10_00;

    const result = calculateCategoryPrepaidUsage(
      DataCategory.SEER_SCANNER,
      subscription,
      prepaid
    );

    expect(result).toEqual({
      onDemandUsage: 0,
      prepaidPercentUsed: 40, // 1000 scans * $0.01 = $10.00, which is 40% of $25.00
      prepaidPrice: 25_00,
      prepaidSpend: 10_00, // 40% of $25.00
      prepaidUsage: 1000,
    });
  });

  it('calculates for SEER reserved budgets when over budget', () => {
    const subscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
    });
    const prepaid = 25_00; // $25.00 budget

    // Set up usage that exceeds the budget
    subscription.categories.seerAutofix = MetricHistoryFixture({
      category: DataCategory.SEER_AUTOFIX,
      reserved: prepaid,
      usage: 30, // 30 fixes used = $30.00 spend, exceeds $25.00 budget
      onDemandQuantity: 5, // 5 fixes went to on-demand
    });

    // Update the reserved budget - spend equals full budget since we're over
    subscription.reservedBudgets![0]!.categories[
      DataCategory.SEER_AUTOFIX
    ]!.reservedSpend = 25_00;

    const result = calculateCategoryPrepaidUsage(
      DataCategory.SEER_AUTOFIX,
      subscription,
      prepaid
    );

    expect(result).toEqual({
      onDemandUsage: 5, // Comes from onDemandQuantity when over budget
      prepaidPercentUsed: 100, // Full budget used
      prepaidPrice: 25_00,
      prepaidSpend: 25_00, // Full budget amount
      prepaidUsage: 25, // total usage - on demand usage = 30 - 5 = 25
    });
  });

  it('calculates for SEER reserved budgets with explicit reservedSpend override', () => {
    const subscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
    });
    const prepaid = 25_00; // $25.00 budget

    subscription.categories.seerAutofix = MetricHistoryFixture({
      category: DataCategory.SEER_AUTOFIX,
      reserved: prepaid,
      usage: 20, // 20 fixes used
      onDemandQuantity: 0,
    });

    // Explicitly pass reservedSpend to override automatic calculation
    const result = calculateCategoryPrepaidUsage(
      DataCategory.SEER_AUTOFIX,
      subscription,
      prepaid,
      null, // accepted
      undefined, // reservedCpe
      15_00 // explicit reservedSpend = $15.00
    );

    expect(result).toEqual({
      onDemandUsage: 0,
      prepaidPercentUsed: 60, // $15.00 is 60% of $25.00
      prepaidPrice: 25_00,
      prepaidSpend: 15_00, // Uses explicit reservedSpend
      prepaidUsage: 20,
    });
  });

  it('calculates for SEER reserved budgets with zero spend', () => {
    const subscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
    });
    const prepaid = 25_00; // $25.00 budget

    subscription.categories.seerAutofix = MetricHistoryFixture({
      category: DataCategory.SEER_AUTOFIX,
      reserved: prepaid,
      usage: 0, // No usage yet
      onDemandQuantity: 0,
    });

    // Reserved spend remains 0 since no usage
    // subscription.reservedBudgets![0]!.categories[DataCategory.SEER_AUTOFIX]!.reservedSpend is already 0

    const result = calculateCategoryPrepaidUsage(
      DataCategory.SEER_AUTOFIX,
      subscription,
      prepaid
    );

    expect(result).toEqual({
      onDemandUsage: 0,
      prepaidPercentUsed: 0, // No spend yet
      prepaidPrice: 25_00,
      prepaidSpend: 0, // No spend
      prepaidUsage: 0,
    });
  });

  it('handles SEER categories not in reserved budgets gracefully', () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_business',
    });

    // Add SEER category but don't include it in reservedBudgets
    subscription.categories.seerAutofix = MetricHistoryFixture({
      category: DataCategory.SEER_AUTOFIX,
      usage: 10,
      onDemandQuantity: 0,
    });

    const prepaid = 25_00;
    const result = calculateCategoryPrepaidUsage(
      DataCategory.SEER_AUTOFIX,
      subscription,
      prepaid
    );

    // Should fall back to usage-based calculation since no reserved budget info found
    expect(result.prepaidSpend).toBe(0); // No price bucket found for SEER in regular subscription
    expect(result.prepaidUsage).toBe(10);
  });

  it('converts prepaid limit to bytes for LOG_BYTE category', () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      planTier: 'am2',
    });
    const prepaidGb = 10; // 10 GB prepaid limit
    const usageBytes = 5 * GIGABYTE; // 5 GB actual usage

    // Add price bucket information for LOG_BYTE category
    subscription.planDetails.planCategories.logBytes = [
      {events: prepaidGb, price: 1000, unitPrice: 0.1, onDemandPrice: 0.2},
    ];

    subscription.categories.logBytes = MetricHistoryFixture({
      prepaid: prepaidGb,
      reserved: prepaidGb,
      usage: usageBytes,
    });

    const result = calculateCategoryPrepaidUsage(
      DataCategory.LOG_BYTE,
      subscription,
      prepaidGb
    );

    // Should multiply prepaid by GIGABYTE for unit conversion
    expect(result).toEqual({
      onDemandUsage: 0,
      prepaidPercentUsed: 50, // 5GB / 10GB = 50%
      prepaidPrice: 1000,
      prepaidSpend: 500,
      prepaidUsage: usageBytes,
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

describe('hasReservedQuotaFunctionality', () => {
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

  it('does not render reserved quota section when reserved is null', () => {
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

  it('renders reserved quota section when reserved is UNLIMITED_RESERVED', () => {
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

  it('renders reserved quota section when reserved is greater than 0', () => {
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

  it('does not render reserved quota section when reserved is 0', () => {
    render(
      <UsageTotals
        category={DataCategory.ERRORS}
        totals={UsageTotalFixture({accepted: 100})}
        reservedUnits={0}
        prepaidUnits={0}
        subscription={subscription}
        organization={organization}
        displayMode="usage"
      />
    );

    expect(screen.queryByTestId('reserved-errors')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gifted-errors')).not.toBeInTheDocument();
  });

  it('renders reserved quota with gifted amount when both present', () => {
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
});

describe('Usage Bar Rendering', () => {
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

  it('renders 100% unused width when reserved is 0 and not a trial', () => {
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

  it('renders correct unused width when reserved is non-zero and not a trial (50% usage)', () => {
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

  it('renders correct unused width when reserved is 0 but is a trial (0% usage)', () => {
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

  it('renders correct unused width when reserved is 0 but is a trial (50% usage)', () => {
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
