import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PendingChangesFixture} from 'getsentry/__fixtures__/pendingChanges';
import {PlanFixture} from 'getsentry/__fixtures__/plan';
import {ANNUAL, MONTHLY} from 'getsentry/constants';
import {OnDemandBudgetMode} from 'getsentry/types';
import PendingChanges from 'getsentry/views/subscriptionPage/pendingChanges';

function getItemWithText(text: string) {
  return screen.getByText(
    (_, node) => node?.nodeName === 'LI' && node.textContent === text
  );
}

describe('Subscription > PendingChanges', function () {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});

  it('renders empty', function () {
    render(<PendingChanges organization={organization} subscription={subscription} />);

    expect(screen.queryByTestId('pending-changes')).not.toBeInTheDocument();
  });

  it('renders mm2 plan and ondemand changes', function () {
    // const planDetails = PlanDetailsLookupFixture();
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_a_500k_ac',
      onDemandMaxSpend: 10000,
      pendingChanges: PendingChangesFixture({
        plan: 'mm2_b_100k',
        reservedEvents: 100000,
        onDemandMaxSpend: 0,
        effectiveDate: '2021-02-01',
        onDemandEffectiveDate: '2021-02-01',
        planDetails: PlanFixture({
          name: 'Team',
          contractInterval: MONTHLY,
        }),
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);

    expect(
      screen.getByText(/The following changes will take effect on/)
    ).toBeInTheDocument();
    expect(screen.getByText('Feb 1, 2021')).toBeInTheDocument();
    expect(getItemWithText('Plan change to Team')).toBeInTheDocument();
    expect(screen.queryByText('Billing period')).not.toBeInTheDocument();
    expect(getItemWithText('Contract period change to monthly')).toBeInTheDocument();
    expect(getItemWithText('Reserved errors change to 100,000')).toBeInTheDocument();
    expect(getItemWithText('On-demand spend change from $100 to $0')).toBeInTheDocument();

    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('renders am1 plan and ondemand changes', function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_a_500k_auf',
      onDemandMaxSpend: 10000,
      pendingChanges: PendingChangesFixture({
        plan: 'am1_team',
        reservedErrors: 100000,
        reservedTransactions: 250000,
        reservedAttachments: 50,
        reserved: {errors: 100000, transactions: 250000, attachments: 50},
        onDemandMaxSpend: 5000,
        effectiveDate: '2021-02-01',
        onDemandEffectiveDate: '2021-02-01',
        planDetails: PlanFixture({
          name: 'Team',
          billingInterval: MONTHLY,
          contractInterval: MONTHLY,
          categories: ['errors', 'transactions', 'attachments'],
        }),
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);

    expect(screen.getByText('Feb 1, 2021')).toBeInTheDocument();
    expect(getItemWithText('Plan change to Team')).toBeInTheDocument();
    expect(getItemWithText('Billing period change to monthly')).toBeInTheDocument();
    expect(getItemWithText('Contract period change to monthly')).toBeInTheDocument();

    expect(getItemWithText('Reserved errors change to 100,000')).toBeInTheDocument();
    expect(
      getItemWithText('Reserved transactions change to 250,000')
    ).toBeInTheDocument();
    expect(getItemWithText('Reserved attachments change to 50 GB')).toBeInTheDocument();
    expect(
      getItemWithText('On-demand spend change from $100 to $50')
    ).toBeInTheDocument();

    expect(screen.getAllByRole('listitem')).toHaveLength(7);
  });

  it('renders mmx to am2 plan and ondemand changes', function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_a_500k_auf',
      onDemandMaxSpend: 10000,
      pendingChanges: PendingChangesFixture({
        plan: 'am2_team',
        reservedErrors: 100000,
        reservedTransactions: 250000,
        reservedAttachments: 50,
        reserved: {errors: 100000, transactions: 250000, attachments: 50},
        onDemandMaxSpend: 5000,
        effectiveDate: '2021-02-01',
        onDemandEffectiveDate: '2021-02-01',
        planDetails: PlanFixture({
          name: 'Team',
          billingInterval: MONTHLY,
          contractInterval: MONTHLY,
          categories: ['errors', 'transactions', 'attachments'],
        }),
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);

    expect(screen.getByText('Feb 1, 2021')).toBeInTheDocument();
    expect(getItemWithText('Plan change to Team')).toBeInTheDocument();
    expect(getItemWithText('Billing period change to monthly')).toBeInTheDocument();
    expect(getItemWithText('Contract period change to monthly')).toBeInTheDocument();

    expect(getItemWithText('Reserved errors change to 100,000')).toBeInTheDocument();
    expect(
      getItemWithText('Reserved transactions change to 250,000')
    ).toBeInTheDocument();
    expect(getItemWithText('Reserved attachments change to 50 GB')).toBeInTheDocument();
    expect(
      getItemWithText('On-demand spend change from $100 to $50')
    ).toBeInTheDocument();

    expect(screen.getAllByRole('listitem')).toHaveLength(7);
  });

  it('renders am1 to am2 plan and ondemand changes', function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am1_team_auf',
      reservedErrors: 100_000,
      reservedTransactions: 100_000,
      reservedAttachments: 25,
      categories: {
        errors: MetricHistoryFixture({reserved: 100_000}),
        transactions: MetricHistoryFixture({reserved: 100_000}),
      },
      onDemandMaxSpend: 10_000,
      pendingChanges: PendingChangesFixture({
        plan: 'am2_business',
        reservedErrors: 100_000,
        reservedTransactions: 250_000,
        reservedAttachments: 50,
        reserved: {errors: 100_000, transactions: 250_000, attachments: 50},
        onDemandMaxSpend: 5_000,
        effectiveDate: '2021-02-01',
        onDemandEffectiveDate: '2021-02-01',
        planDetails: PlanFixture({
          name: 'Business',
          billingInterval: MONTHLY,
          contractInterval: MONTHLY,
          categories: ['errors', 'transactions', 'attachments'],
        }),
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);

    expect(screen.getByText('Feb 1, 2021')).toBeInTheDocument();
    expect(getItemWithText('Plan change to Business')).toBeInTheDocument();
    expect(getItemWithText('Billing period change to monthly')).toBeInTheDocument();
    expect(getItemWithText('Contract period change to monthly')).toBeInTheDocument();

    expect(
      getItemWithText('Reserved transactions change to 250,000')
    ).toBeInTheDocument();
    expect(getItemWithText('Reserved attachments change to 50 GB')).toBeInTheDocument();
    expect(
      getItemWithText('On-demand spend change from $100 to $50')
    ).toBeInTheDocument();

    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('renders am1 plan and pending shared ondemand changes', function () {
    const org = OrganizationFixture({
      features: ['ondemand-budgets'],
    });
    const sub = SubscriptionFixture({
      organization: org,
      plan: 'am1_business',
      reservedErrors: 500000,
      categories: {
        errors: MetricHistoryFixture({reserved: 500000}),
      },
      onDemandMaxSpend: 10000,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 5000,
        onDemandSpendUsed: 0,
      },
      pendingChanges: PendingChangesFixture({
        plan: 'am1_team',
        reservedErrors: 100000,
        reservedTransactions: 250000,
        reservedAttachments: 50,
        reserved: {errors: 100000, transactions: 250000, attachments: 50},
        onDemandMaxSpend: 5000,
        onDemandBudgets: {
          enabled: true,
          budgetMode: OnDemandBudgetMode.SHARED,
          sharedMaxBudget: 1000,
        },
        effectiveDate: '2021-02-01',
        onDemandEffectiveDate: '2021-02-01',
        planDetails: PlanFixture({
          name: 'Team',
          billingInterval: MONTHLY,
          contractInterval: MONTHLY,
          categories: ['errors', 'transactions', 'attachments'],
        }),
      }),
    });

    render(<PendingChanges subscription={sub} organization={org} />);

    expect(
      getItemWithText(
        'On-demand budget change from shared on-demand of $50 to shared on-demand of $10'
      )
    ).toBeInTheDocument();
  });

  it('renders am1 plan and pending per-category ondemand changes', function () {
    const org = OrganizationFixture({
      features: ['ondemand-budgets'],
    });
    const sub = SubscriptionFixture({
      organization: org,
      plan: 'am1_business',
      reservedErrors: 500000,
      onDemandMaxSpend: 10000,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 5000,
        onDemandSpendUsed: 0,
      },
      pendingChanges: PendingChangesFixture({
        plan: 'am1_team',
        reservedErrors: 100000,
        reservedTransactions: 250000,
        reservedAttachments: 50,
        reserved: {errors: 100000, transactions: 250000, attachments: 50},
        onDemandMaxSpend: 5000,
        onDemandBudgets: {
          enabled: true,
          budgetMode: OnDemandBudgetMode.PER_CATEGORY,
          errorsBudget: 1000,
          transactionsBudget: 2000,
          attachmentsBudget: 3000,
          replaysBudget: 0,
          budgets: {errors: 1000, transactions: 2000, attachments: 3000},
        },
        effectiveDate: '2021-02-01',
        onDemandEffectiveDate: '2021-02-01',
        planDetails: PlanFixture({
          name: 'Team',
          billingInterval: MONTHLY,
          contractInterval: MONTHLY,
          categories: ['errors', 'transactions', 'attachments'],
          onDemandCategories: ['errors', 'transactions', 'attachments'],
        }),
      }),
    });

    render(<PendingChanges subscription={sub} organization={org} />);

    expect(
      getItemWithText(
        'On-demand budget change from shared on-demand of $50 to per-category on-demand (errors at $10, transactions at $20, and attachments at $30)'
      )
    ).toBeInTheDocument();
  });

  it('renders plan change only', function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_a_500k_auf',
      reservedErrors: 500000,
      onDemandMaxSpend: 0,
      pendingChanges: PendingChangesFixture({
        plan: 'am1_team_auf',
        reservedErrors: null,
        reservedTransactions: null,
        reservedAttachments: null,
        onDemandMaxSpend: 0,
        effectiveDate: '2021-02-01',
        planDetails: PlanFixture({
          name: 'Team',
          categories: ['errors', 'transactions', 'attachments'],
          billingInterval: ANNUAL,
          contractInterval: ANNUAL,
        }),
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);

    expect(screen.getByText('Feb 1, 2021')).toBeInTheDocument();
    expect(getItemWithText('Plan change to Team')).toBeInTheDocument();

    expect(screen.getByRole('listitem')).toBeInTheDocument();
  });

  it('renders plan and ondemand changes on different dates', function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_a_500k_auf',
      reservedErrors: 500000,
      onDemandMaxSpend: 10000,
      pendingChanges: PendingChangesFixture({
        plan: 'am1_team',
        onDemandMaxSpend: 5000,
        effectiveDate: '2021-02-01',
        onDemandEffectiveDate: '2021-03-01',
        planDetails: PlanFixture({
          name: 'Team',
          categories: ['errors', 'transactions', 'attachments'],
          billingInterval: ANNUAL,
          contractInterval: ANNUAL,
        }),
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);

    expect(screen.getByText('Mar 1, 2021')).toBeInTheDocument();
    expect(
      getItemWithText('On-demand spend change from $100 to $50')
    ).toBeInTheDocument();

    expect(screen.getByText('Feb 1, 2021')).toBeInTheDocument();
    expect(getItemWithText('Plan change to Team')).toBeInTheDocument();

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders on-demand to pay-as-you go pending changes for am2 to am3', function () {
    organization.features.push('ondemand-budgets');
    const sub = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        errorsBudget: 1000,
        replaysBudget: 0,
        transactionsBudget: 0,
        attachmentsBudget: 0,
        budgets: {
          errors: 1000,
        },
        attachmentSpendUsed: 0,
        errorSpendUsed: 0,
        transactionSpendUsed: 0,
        usedSpends: {},
      },
      pendingChanges: PendingChangesFixture({
        plan: 'am3_business',
        onDemandBudgets: {
          enabled: true,
          budgetMode: OnDemandBudgetMode.SHARED,
          sharedMaxBudget: 5000,
        },
        planDetails: PlanFixture({
          name: 'Business',
          categories: ['errors', 'replays', 'spans', 'monitorSeats', 'attachments'],
          billingInterval: ANNUAL,
          contractInterval: ANNUAL,
        }),
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);
    expect(
      screen.getByText(
        'Pay-as-you-go budget change from per-category on-demand (errors at $10, performance units at $0, replays at $0, attachments at $0, cron monitors at $0, profile hours at $0, and uptime monitors at $0) to shared pay-as-you-go of $50'
      )
    ).toBeInTheDocument();
  });

  it('handles missing subscription values', function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_a_500k_auf',
      reservedErrors: 500000,
      onDemandMaxSpend: 10000,
      planDetails: undefined,
      pendingChanges: PendingChangesFixture({
        plan: 'am1_team',
        onDemandMaxSpend: 5000,
        effectiveDate: '2021-02-01',
        onDemandEffectiveDate: '2021-03-01',
        planDetails: PlanFixture({
          name: 'Team',
          contractInterval: ANNUAL,
          categories: ['errors', 'transactions', 'attachments'],
        }),
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);
    expect(screen.getByText('Feb 1, 2021')).toBeInTheDocument();
  });
});
