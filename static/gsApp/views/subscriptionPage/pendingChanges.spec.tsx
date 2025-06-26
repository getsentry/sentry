import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {
  PendingReservedBudgetFixture,
  SeerReservedBudgetFixture,
} from 'getsentry-test/fixtures/reservedBudget';
import {
  Am3DsEnterpriseSubscriptionFixture,
  SubscriptionFixture,
} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import {PendingChangesFixture} from 'getsentry/__fixtures__/pendingChanges';
import {PlanFixture} from 'getsentry/__fixtures__/plan';
import {ANNUAL, MONTHLY, RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
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
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_a_500k_ac',
      onDemandMaxSpend: 10000,
      pendingChanges: PendingChangesFixture({
        plan: 'mm2_b_100k',
        reserved: {
          errors: 100_000,
        },
        onDemandMaxSpend: 0,
        effectiveDate: '2021-02-01',
        onDemandEffectiveDate: '2021-02-01',
        planDetails: PlanFixture({
          name: 'Team',
          contractInterval: MONTHLY,
          budgetTerm: 'on-demand',
          categories: [DataCategory.ERRORS, DataCategory.TRANSACTIONS],
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
    expect(getItemWithText('On-Demand spend change from $100 to $0')).toBeInTheDocument();

    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('renders am1 plan and ondemand changes', function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_a_500k_auf',
      onDemandMaxSpend: 10000,
      pendingChanges: PendingChangesFixture({
        plan: 'am1_team',
        reserved: {errors: 100000, transactions: 250000, attachments: 50},
        onDemandMaxSpend: 5000,
        effectiveDate: '2021-02-01',
        onDemandEffectiveDate: '2021-02-01',
        planDetails: PlanFixture({
          name: 'Team',
          billingInterval: MONTHLY,
          contractInterval: MONTHLY,
          categories: [
            DataCategory.ERRORS,
            DataCategory.TRANSACTIONS,
            DataCategory.ATTACHMENTS,
          ],
          budgetTerm: 'on-demand',
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
      getItemWithText('On-Demand spend change from $100 to $50')
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
        reserved: {errors: 100000, transactions: 250000, attachments: 50},
        onDemandMaxSpend: 5000,
        effectiveDate: '2021-02-01',
        onDemandEffectiveDate: '2021-02-01',
        planDetails: PlanFixture({
          name: 'Team',
          billingInterval: MONTHLY,
          contractInterval: MONTHLY,
          categories: [
            DataCategory.ERRORS,
            DataCategory.TRANSACTIONS,
            DataCategory.ATTACHMENTS,
          ],
          budgetTerm: 'on-demand',
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
      getItemWithText('On-Demand spend change from $100 to $50')
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
        reserved: {errors: 100_000, transactions: 250_000, attachments: 50},
        onDemandMaxSpend: 5_000,
        effectiveDate: '2021-02-01',
        onDemandEffectiveDate: '2021-02-01',
        planDetails: PlanFixture({
          name: 'Business',
          billingInterval: MONTHLY,
          contractInterval: MONTHLY,
          categories: [
            DataCategory.ERRORS,
            DataCategory.TRANSACTIONS,
            DataCategory.ATTACHMENTS,
          ],
          budgetTerm: 'on-demand',
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
      getItemWithText('On-Demand spend change from $100 to $50')
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
          categories: [
            DataCategory.ERRORS,
            DataCategory.TRANSACTIONS,
            DataCategory.ATTACHMENTS,
          ],
          budgetTerm: 'on-demand',
        }),
      }),
    });

    render(<PendingChanges subscription={sub} organization={org} />);

    expect(
      getItemWithText(
        'On-Demand budget change from shared on-demand budget of $50 to shared on-demand budget of $10'
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
      onDemandMaxSpend: 10000,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 5000,
        onDemandSpendUsed: 0,
      },
      pendingChanges: PendingChangesFixture({
        plan: 'am1_team',
        reserved: {errors: 100000, transactions: 250000, attachments: 50},
        onDemandMaxSpend: 5000,
        onDemandBudgets: {
          enabled: true,
          budgetMode: OnDemandBudgetMode.PER_CATEGORY,
          budgets: {errors: 1000, transactions: 2000, attachments: 3000},
        },
        effectiveDate: '2021-02-01',
        onDemandEffectiveDate: '2021-02-01',
        planDetails: PlanFixture({
          name: 'Team',
          billingInterval: MONTHLY,
          contractInterval: MONTHLY,
          categories: [
            DataCategory.ERRORS,
            DataCategory.TRANSACTIONS,
            DataCategory.ATTACHMENTS,
          ],
          onDemandCategories: [
            DataCategory.ERRORS,
            DataCategory.TRANSACTIONS,
            DataCategory.ATTACHMENTS,
          ],
          budgetTerm: 'on-demand',
        }),
      }),
    });

    render(<PendingChanges subscription={sub} organization={org} />);

    expect(
      getItemWithText(
        'On-Demand budget change from shared on-demand budget of $50 to per-category on-demand budget (errors at $10, transactions at $20, and attachments at $30)'
      )
    ).toBeInTheDocument();
  });

  it('renders plan change only', function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_a_500k_auf',
      onDemandMaxSpend: 0,
      pendingChanges: PendingChangesFixture({
        plan: 'am1_team_auf',
        onDemandMaxSpend: 0,
        effectiveDate: '2021-02-01',
        planDetails: PlanFixture({
          name: 'Team',
          categories: [
            DataCategory.ERRORS,
            DataCategory.TRANSACTIONS,
            DataCategory.ATTACHMENTS,
          ],
          billingInterval: ANNUAL,
          contractInterval: ANNUAL,
          budgetTerm: 'on-demand',
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
      onDemandMaxSpend: 10000,
      pendingChanges: PendingChangesFixture({
        plan: 'am1_team',
        onDemandMaxSpend: 5000,
        effectiveDate: '2021-02-01',
        onDemandEffectiveDate: '2021-03-01',
        planDetails: PlanFixture({
          name: 'Team',
          categories: [
            DataCategory.ERRORS,
            DataCategory.TRANSACTIONS,
            DataCategory.ATTACHMENTS,
          ],
          billingInterval: ANNUAL,
          contractInterval: ANNUAL,
          budgetTerm: 'on-demand',
        }),
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);

    expect(screen.getByText('Mar 1, 2021')).toBeInTheDocument();
    expect(
      getItemWithText('On-Demand spend change from $100 to $50')
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
        budgets: {
          errors: 1000,
          transactions: 0,
          attachments: 0,
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
          categories: [
            DataCategory.ERRORS,
            DataCategory.REPLAYS,
            DataCategory.SPANS,
            DataCategory.MONITOR_SEATS,
            DataCategory.ATTACHMENTS,
          ],
          billingInterval: ANNUAL,
          contractInterval: ANNUAL,
        }),
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);
    expect(
      screen.getByText(
        'Pay-as-you-go budget change from per-category on-demand budget (errors at $10, performance units at $0, replays at $0, attachments at $0, cron monitors at $0, uptime monitors at $0, continuous profile hours at $0, and UI profile hours at $0) to shared pay-as-you-go budget of $50'
      )
    ).toBeInTheDocument();
  });

  it('handles missing subscription values', function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_a_500k_auf',
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
          categories: [
            DataCategory.ERRORS,
            DataCategory.TRANSACTIONS,
            DataCategory.ATTACHMENTS,
          ],
          budgetTerm: 'on-demand',
        }),
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);
    expect(screen.getByText('Feb 1, 2021')).toBeInTheDocument();
  });

  it('does not render reserved budget changes', function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_business',
      reservedBudgets: [SeerReservedBudgetFixture({})],
      pendingChanges: PendingChangesFixture({
        planDetails: PlanDetailsLookupFixture('am3_business'),
        plan: 'am3_business',
        planName: 'Business',
        reserved: {
          errors: 100_000,
        },
      }),
    });
    sub.categories = {
      ...sub.categories,
      seerAutofix: MetricHistoryFixture({...sub.categories.seerAutofix, reserved: 0}),
      seerScanner: MetricHistoryFixture({...sub.categories.seerScanner, reserved: 0}),
    };

    render(<PendingChanges organization={organization} subscription={sub} />);
    expect(screen.getByText('Reserved errors change to 100,000')).toBeInTheDocument();
    expect(screen.queryByText(/product access/)).not.toBeInTheDocument();
    expect(screen.queryByText(/budget change/)).not.toBeInTheDocument();
  });

  it('renders reserved budgets with existing budgets without dynamic sampling', function () {
    const sub = Am3DsEnterpriseSubscriptionFixture({
      organization,
      pendingChanges: PendingChangesFixture({
        planDetails: PlanDetailsLookupFixture('am3_business_ent_ds_auf'),
        plan: 'am3_business_ent_ds_auf',
        planName: 'Business',
        reserved: {
          spans: RESERVED_BUDGET_QUOTA,
          spansIndexed: RESERVED_BUDGET_QUOTA,
        },
        reservedCpe: {
          spans: 12.345678,
          spansIndexed: 87.654321,
        },
        reservedBudgets: [
          {
            reservedBudget: 50_000_00,
            categories: {spans: true, spansIndexed: true},
          },
        ],
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);

    expect(screen.queryByText('accepted spans')).not.toBeInTheDocument();
    expect(screen.queryByText('stored spans')).not.toBeInTheDocument();
    expect(screen.queryByText('cost-per-event')).not.toBeInTheDocument();
    expect(
      screen.getByText('Spans budget change from $100,000 to $50,000')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Reserved spans/)).not.toBeInTheDocument();
  });

  it('renders reserved budgets with existing budgets and dynamic sampling', function () {
    const sub = Am3DsEnterpriseSubscriptionFixture({
      organization,
      pendingChanges: PendingChangesFixture({
        planDetails: PlanDetailsLookupFixture('am3_business_ent_ds_auf'),
        plan: 'am3_business_ent_ds_auf',
        planName: 'Business',
        reserved: {
          spans: RESERVED_BUDGET_QUOTA,
          spansIndexed: RESERVED_BUDGET_QUOTA,
        },
        reservedCpe: {
          spans: 12.345678,
          spansIndexed: 87.654321,
        },
        reservedBudgets: [
          {
            reservedBudget: 50_000_00,
            categories: {spans: true, spansIndexed: true},
          },
        ],
      }),
      hadCustomDynamicSampling: true,
    });

    render(<PendingChanges organization={organization} subscription={sub} />);

    expect(screen.queryByText('cost-per-event')).not.toBeInTheDocument();
    expect(
      screen.getByText('Spans budget change from $100,000 to $50,000')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Reserved spans/)).not.toBeInTheDocument();
  });

  it('renders fixed reserved budget changes for disabling', function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      reservedBudgets: [SeerReservedBudgetFixture({})],
      pendingChanges: PendingChangesFixture({
        planDetails: PlanDetailsLookupFixture('am3_team'),
        plan: 'am3_team',
        planName: 'Team',
        reserved: {
          seerAutofix: 0,
          seerScanner: 0,
        },
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);

    expect(screen.getByText('Seer product access will be disabled')).toBeInTheDocument();
    expect(
      screen.queryByText('Seer product access will be enabled')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Seer budget')).not.toBeInTheDocument();
    expect(screen.queryByText(/Reserved issue fixes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reserved issue scans/)).not.toBeInTheDocument();
  });

  it('renders fixed reserved budget changes for enabling', function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      reservedBudgets: [],
      pendingChanges: PendingChangesFixture({
        planDetails: PlanDetailsLookupFixture('am3_team'),
        plan: 'am3_team',
        planName: 'Team',
        reserved: {
          seerAutofix: RESERVED_BUDGET_QUOTA,
          seerScanner: RESERVED_BUDGET_QUOTA,
        },
        reservedBudgets: [
          PendingReservedBudgetFixture({
            categories: {
              seerAutofix: true,
              seerScanner: true,
            },
            reservedBudget: SeerReservedBudgetFixture({}).reservedBudget,
          }),
        ],
        reservedCpe: {
          seerAutofix: 1_00,
          seerScanner: 1,
        },
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);

    expect(screen.getByText('Seer product access will be enabled')).toBeInTheDocument();
    expect(
      screen.queryByText('Seer product access will be disabled')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Seer budget')).not.toBeInTheDocument();
    expect(screen.queryByText(/Reserved issue fixes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reserved issue scans/)).not.toBeInTheDocument();
  });

  it('renders multiple reserved budgets', function () {
    const sub = Am3DsEnterpriseSubscriptionFixture({
      organization,
      pendingChanges: PendingChangesFixture({
        planDetails: PlanDetailsLookupFixture('am3_business_ent_ds_auf'),
        plan: 'am3_business_ent_ds_auf',
        planName: 'Business',
        reserved: {
          errors: RESERVED_BUDGET_QUOTA,
          spans: RESERVED_BUDGET_QUOTA,
          spansIndexed: RESERVED_BUDGET_QUOTA,
        },
        reservedCpe: {
          errors: 0.123456,
          spans: 12.345678,
          spansIndexed: 87.654321,
        },
        reservedBudgets: [
          {
            reservedBudget: 50_000_00,
            categories: {spans: true, spansIndexed: true},
          },
          {
            reservedBudget: 10_000_00,
            categories: {errors: true},
          },
        ],
      }),
      hadCustomDynamicSampling: true,
    });

    render(<PendingChanges organization={organization} subscription={sub} />);

    expect(screen.queryByText('cost-per-event')).not.toBeInTheDocument();
    expect(
      screen.getByText('Spans budget change from $100,000 to $50,000')
    ).toBeInTheDocument();
    expect(screen.getByText('Errors budget change to $10,000')).toBeInTheDocument();
    expect(screen.queryByText(/Reserved spans/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reserved errors/)).not.toBeInTheDocument();
  });

  it('renders reserved budgets without existing budgets', function () {
    const sub = SubscriptionFixture({
      organization: OrganizationFixture(),
      plan: 'am3_business',
      pendingChanges: PendingChangesFixture({
        planDetails: PlanDetailsLookupFixture('am3_business_ent_ds_auf'),
        plan: 'am3_business_ent_ds_auf',
        planName: 'Business',
        reserved: {
          spans: RESERVED_BUDGET_QUOTA,
          spansIndexed: RESERVED_BUDGET_QUOTA,
        },
        reservedCpe: {
          spans: 12.345678,
          spansIndexed: 87.654321,
        },
        reservedBudgets: [
          {
            reservedBudget: 50_000_00,
            categories: {spans: true, spansIndexed: true},
          },
        ],
      }),
    });
    render(<PendingChanges organization={organization} subscription={sub} />);

    expect(screen.queryByText('accepted spans')).not.toBeInTheDocument();
    expect(screen.queryByText('stored spans')).not.toBeInTheDocument();
    expect(screen.queryByText('cost-per-event')).not.toBeInTheDocument();
    expect(screen.getByText('Spans budget change to $50,000')).toBeInTheDocument();
    expect(screen.queryByText(/Reserved spans/)).not.toBeInTheDocument();
    expect(screen.getByText('Plan change to Enterprise (Business)')).toBeInTheDocument();
  });

  it('renders reserved budgets to reserved volume', function () {
    const sub = Am3DsEnterpriseSubscriptionFixture({
      organization: OrganizationFixture(),
      pendingChanges: PendingChangesFixture({
        planDetails: PlanDetailsLookupFixture('am3_business_ent_auf'),
        plan: 'am3_business_ent_auf',
        planName: 'Business',
        reserved: {
          spans: 10_000_000,
        },
      }),
    });

    render(<PendingChanges organization={organization} subscription={sub} />);

    expect(screen.queryByText('accepted spans')).not.toBeInTheDocument();
    expect(screen.queryByText('stored spans')).not.toBeInTheDocument();
    expect(screen.queryByText('cost-per-event')).not.toBeInTheDocument();
    expect(screen.queryByText('Spans budget')).not.toBeInTheDocument();
    expect(screen.getByText('Reserved spans change to 10,000,000')).toBeInTheDocument();
    expect(screen.getByText('Plan change to Enterprise (Business)')).toBeInTheDocument();
  });
});
