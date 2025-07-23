import {OrganizationFixture} from 'sentry-fixture/organization';

import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {PlanMigrationFixture} from 'getsentry-test/fixtures/planMigration';
import {SeerReservedBudgetFixture} from 'getsentry-test/fixtures/reservedBudget';
import {
  Am3DsEnterpriseSubscriptionFixture,
  SubscriptionFixture,
} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import PendingChanges from 'admin/components/customers/pendingChanges';
import {PendingChangesFixture} from 'getsentry/__fixtures__/pendingChanges';
import {PlanFixture} from 'getsentry/__fixtures__/plan';
import {ANNUAL, RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import * as usePlanMigrations from 'getsentry/hooks/usePlanMigrations';
import {CohortId, OnDemandBudgetMode} from 'getsentry/types';

describe('PendingChanges', function () {
  it('renders null pendingChanges)', function () {
    const subscription = SubscriptionFixture({
      organization: OrganizationFixture(),
    });
    const {container} = render(<PendingChanges subscription={subscription} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders empty pendingChanges', function () {
    const subscription = SubscriptionFixture({
      organization: OrganizationFixture(),
      pendingChanges: null,
    });
    const {container} = render(<PendingChanges subscription={subscription} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders pending changes', function () {
    const subscription = SubscriptionFixture({
      organization: OrganizationFixture(),
      customPrice: 0,
      customPricePcss: 0,
      pendingChanges: PendingChangesFixture({
        planDetails: PlanFixture({
          name: 'Team (Enterprise)',
          contractInterval: 'annual',
          billingInterval: 'annual',
        }),
        plan: 'am1_team_ent',
        planName: 'Team (Enterprise)',
        reserved: {errors: 15000000, transactions: 20000000, attachments: 25},
        customPrice: 5000000,
        customPrices: {errors: 2000000, transactions: 2900000, attachments: 50000},
        customPricePcss: 50000,
        onDemandMaxSpend: 50000,
        effectiveDate: '2022-03-16',
        onDemandEffectiveDate: '2022-02-16',
      }),
    });
    const {container} = render(<PendingChanges subscription={subscription} />);

    // expected copy for plan changes
    expect(container).toHaveTextContent(
      'This account has pending changes to the subscription'
    );
    expect(container).toHaveTextContent(
      'The following changes will take effect on Mar 16, 2022'
    );
    expect(container).toHaveTextContent('Plan changes — Developer → Team (Enterprise)');
    expect(container).toHaveTextContent('Contract period — monthly → annual');
    expect(container).toHaveTextContent('Billing period — monthly → annual');
    expect(container).toHaveTextContent('Reserved errors — 5,000 → 15,000,000 errors');
    expect(container).toHaveTextContent(
      'Reserved transactions — 10,000 → 20,000,000 transactions'
    );
    expect(container).toHaveTextContent('Reserved attachments — 1 GB → 25 GB');
    expect(container).toHaveTextContent('Custom price (ACV) — $0.00 → $50,000.00');
    expect(container).toHaveTextContent('Custom price for errors — $0.00 → $20,000.00');
    expect(container).toHaveTextContent(
      'Custom price for transactions — $0.00 → $29,000.00'
    );
    expect(container).toHaveTextContent('Custom price for attachments — $0.00 → $500.00');
    expect(container).toHaveTextContent('Custom price for PCSS — $0.00 → $500.00');

    // expected copy for on-demand changes
    expect(container).toHaveTextContent(
      'The following changes will take effect on Feb 16, 2022'
    );
    expect(container).toHaveTextContent('On-demand maximum — $0.00 → $500.00');
  });

  it('renders pending changes with all categories', function () {
    const subscription = SubscriptionFixture({
      organization: OrganizationFixture(),
      customPrice: 0,
      customPricePcss: 0,
      pendingChanges: PendingChangesFixture({
        planDetails: PlanFixture({
          name: 'Team (Enterprise)',
          contractInterval: 'annual',
          billingInterval: 'annual',
        }),
        plan: 'am3_team_ent',
        planName: 'Team (Enterprise)',
        reserved: {errors: 15000000, spans: 20000000, attachments: 25},
        customPrice: 5000000,
        customPrices: {errors: 2000000, spans: 200000, attachments: 50000},
        customPricePcss: 50000,
        onDemandMaxSpend: 50000,
        effectiveDate: '2024-10-09',
        onDemandEffectiveDate: '2024-02-20',
      }),
    });
    const {container} = render(<PendingChanges subscription={subscription} />);

    // expected copy for plan changes
    expect(container).toHaveTextContent(
      'This account has pending changes to the subscription'
    );
    expect(container).toHaveTextContent(
      'The following changes will take effect on Oct 9, 2024'
    );
    expect(container).toHaveTextContent('Plan changes — Developer → Team (Enterprise)');
    expect(container).toHaveTextContent('Contract period — monthly → annual');
    expect(container).toHaveTextContent('Billing period — monthly → annual');
    expect(container).toHaveTextContent('Reserved errors — 5,000 → 15,000,000 errors');
    expect(container).toHaveTextContent(
      'Reserved transactions — 10,000 → 0 transactions'
    );
    expect(container).toHaveTextContent('Reserved spans — 0 → 20,000,000 spans');
    expect(container).toHaveTextContent('Reserved attachments — 1 GB → 25 GB');
    expect(container).toHaveTextContent('Custom price (ACV) — $0.00 → $50,000.00');
    expect(container).toHaveTextContent('Custom price for errors — $0.00 → $20,000.00');
    expect(container).toHaveTextContent('Custom price for spans — $0.00 → $2,000.00');
    expect(container).toHaveTextContent('Custom price for attachments — $0.00 → $500.00');
    expect(container).toHaveTextContent('Custom price for PCSS — $0.00 → $500.00');

    // expected copy for on-demand changes
    expect(container).toHaveTextContent(
      'The following changes will take effect on Feb 20, 2024'
    );
    expect(container).toHaveTextContent('On-demand maximum — $0.00 → $500.00');
  });

  it('renders on-demand budgets', function () {
    const subscription = SubscriptionFixture({
      organization: OrganizationFixture(),
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 10000,
        onDemandSpendUsed: 0,
      },
      pendingChanges: PendingChangesFixture({
        planDetails: PlanFixture({
          name: 'Team (Enterprise)',
          contractInterval: 'annual',
          billingInterval: 'annual',
          onDemandCategories: [
            DataCategory.ERRORS,
            DataCategory.TRANSACTIONS,
            DataCategory.ATTACHMENTS,
          ],
          budgetTerm: 'on-demand',
        }),
        onDemandBudgets: {
          enabled: true,
          budgetMode: OnDemandBudgetMode.PER_CATEGORY,
          budgets: {errors: 300, transactions: 200, replays: 0, attachments: 100},
        },
        onDemandMaxSpend: 50000,
        effectiveDate: '2022-03-16',
        onDemandEffectiveDate: '2022-02-16',
      }),
    });
    const {container} = render(<PendingChanges subscription={subscription} />);

    // expected copy for plan changes
    expect(container).toHaveTextContent(
      'This account has pending changes to the subscription'
    );
    expect(container).toHaveTextContent(
      'The following changes will take effect on Mar 16, 2022'
    );

    // expected copy for on-demand changes
    expect(container).toHaveTextContent(
      'The following changes will take effect on Feb 16, 2022'
    );
    expect(container).toHaveTextContent(
      'On-demand budget — shared on-demand budget of $100 → per-category on-demand budget (errors at $3, transactions at $2, and attachments at $1)'
    );
  });

  it('combines regular and on-demand changes', function () {
    const subscription = SubscriptionFixture({
      organization: OrganizationFixture(),
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 10000,
        onDemandSpendUsed: 0,
      },
      pendingChanges: PendingChangesFixture({
        planDetails: PlanFixture({
          name: 'Team (Enterprise)',
          contractInterval: 'annual',
          billingInterval: 'annual',
          onDemandCategories: [
            DataCategory.ERRORS,
            DataCategory.TRANSACTIONS,
            DataCategory.ATTACHMENTS,
          ],
          budgetTerm: 'on-demand',
        }),
        onDemandBudgets: {
          enabled: true,
          budgetMode: OnDemandBudgetMode.PER_CATEGORY,
          budgets: {errors: 300, transactions: 200, replays: 0, attachments: 100},
        },
        onDemandMaxSpend: 50000,
        effectiveDate: '2022-03-16',
        onDemandEffectiveDate: '2022-03-16',
      }),
    });
    const {container} = render(<PendingChanges subscription={subscription} />);

    expect(container).toHaveTextContent(
      'This account has pending changes to the subscription'
    );
    expect(container).toHaveTextContent(
      'The following changes will take effect on Mar 16, 2022'
    );
    expect(container).toHaveTextContent('Plan changes — Developer → Team (Enterprise)');
    expect(container).toHaveTextContent(
      'On-demand budget — shared on-demand budget of $100 → per-category on-demand budget (errors at $3, transactions at $2, and attachments at $1)'
    );
    expect(screen.getAllByText(/The following changes will take effect on/)).toHaveLength(
      1
    );
  });

  it('renders pending changes for plan migration', function () {
    const organization = OrganizationFixture();
    const am2BusinessPlan = PlanDetailsLookupFixture('am2_business_auf');
    const subscription = SubscriptionFixture({
      planDetails: am2BusinessPlan,
      plan: 'am2_business_auf',
      contractInterval: ANNUAL,
      organization,
      onDemandPeriodEnd: '2018-10-24',
      contractPeriodEnd: '2019-09-24',
      pendingChanges: PendingChangesFixture({
        planDetails: PlanFixture({
          id: 'am3_business_auf',
          name: 'Business',
          contractInterval: 'annual',
          billingInterval: 'annual',
          onDemandCategories: [
            DataCategory.ERRORS,
            DataCategory.ATTACHMENTS,
            DataCategory.SPANS,
            DataCategory.REPLAYS,
            DataCategory.MONITOR_SEATS,
          ],
        }),
        reserved: {
          errors: 50_000,
          spans: 10_000_000,
          replays: 50,
          monitorSeats: 1,
          attachments: 1,
        },
        effectiveDate: '2019-09-25',
        onDemandEffectiveDate: '2018-10-25',
      }),
    });
    const migrationDate = '2018-10-25';
    const migration = PlanMigrationFixture({
      cohortId: CohortId.TENTH,
      effectiveAt: migrationDate,
    });
    jest
      .spyOn(usePlanMigrations, 'usePlanMigrations')
      .mockReturnValue({planMigrations: [migration], isLoading: false});

    const {container} = render(<PendingChanges subscription={subscription} />);

    // expected copy for plan changes
    expect(container).toHaveTextContent(
      'This account has pending changes to the subscription'
    );
    expect(container).toHaveTextContent(
      'The following changes will take effect on Oct 25, 2018'
    );
    expect(container).toHaveTextContent('Plan changes — Business → Business');
    expect(container).toHaveTextContent(
      'Reserved performance units — 100,000 → 0 transactions'
    );
    expect(container).toHaveTextContent('Reserved replays — 500 → 50 replays');
    expect(container).toHaveTextContent('Reserved spans — 0 → 10,000,000 spans');

    // no actual changes
    expect(container).not.toHaveTextContent('Reserved errors — 50,000 → 50,000 errors');
    expect(container).not.toHaveTextContent(
      'Reserved attachments — 1 GB → 1 GB attachments'
    );
    expect(container).not.toHaveTextContent(
      'Reserved cron monitors — 1 → 1 cron monitor'
    );
  });

  it('renders reserved budgets with existing budgets', function () {
    const subscription = Am3DsEnterpriseSubscriptionFixture({
      organization: OrganizationFixture(),
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
          seerAutofix: 1_00,
          seerScanner: 1,
        },
        reservedBudgets: [
          {
            reservedBudget: 0,
            categories: {seerAutofix: true, seerScanner: true},
          },
          {
            reservedBudget: 50_000_00,
            categories: {spans: true, spansIndexed: true},
          },
        ],
      }),
    });

    const {container} = render(<PendingChanges subscription={subscription} />);

    expect(container).not.toHaveTextContent('Plan changes —');
    expect(container).not.toHaveTextContent('Reserved spans —');
    expect(container).not.toHaveTextContent('Reserved accepted spans —');
    expect(container).not.toHaveTextContent('Reserved spansIndexed —');
    expect(container).not.toHaveTextContent('Reserved stored spans —');

    expect(container).toHaveTextContent(
      'Reserved cost-per-event for accepted spans — $0.01000000 → $0.12345678'
    );
    expect(container).toHaveTextContent(
      'Reserved cost-per-event for stored spans — $0.02000000 → $0.87654321'
    );
    expect(container).toHaveTextContent(
      'Reserved budgets — $0.00 for seer budget, $100,000.00 for spans budget → $0.00 for seer budget, $50,000.00 for spans budget'
    );
  });

  it('does not render reserved budgets with mocked values', function () {
    const subscription = SubscriptionFixture({
      organization: OrganizationFixture(),
      reservedBudgets: [
        SeerReservedBudgetFixture({
          id: '0',
          reservedBudget: 0,
        }),
      ],
      pendingChanges: PendingChangesFixture({
        planDetails: PlanDetailsLookupFixture('am3_business_ent'),
        plan: 'am3_business_ent',
        planName: 'Business',
        reserved: {
          spans: 0,
          spansIndexed: 0,
        },
        reservedBudgets: [
          {
            reservedBudget: 0,
            categories: {seerAutofix: true, seerScanner: true},
          },
        ],
      }),
    });

    const {container} = render(<PendingChanges subscription={subscription} />);

    expect(container).not.toHaveTextContent(
      'Reserved budgets — $0.00 for seer budget → $0.00 for seer budget'
    );
  });

  it('renders reserved budgets without existing budgets', function () {
    const subscription = SubscriptionFixture({
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
          seerAutofix: 1_00,
          seerScanner: 1,
        },
        reservedBudgets: [
          {
            reservedBudget: 0,
            categories: {seerAutofix: true, seerScanner: true},
          },
          {
            reservedBudget: 50_000_00,
            categories: {spans: true, spansIndexed: true},
          },
        ],
      }),
    });

    const {container} = render(<PendingChanges subscription={subscription} />);

    expect(container).toHaveTextContent(
      'Plan changes — Business → Enterprise (Business)'
    );
    expect(container).toHaveTextContent(
      'Reserved accepted spans — 10,000,000 → reserved budget'
    );
    expect(container).toHaveTextContent('Reserved stored spans — 0 → reserved budget');
    expect(container).not.toHaveTextContent('Reserved spans —');
    expect(container).not.toHaveTextContent('Reserved spansIndexed —');

    expect(container).toHaveTextContent(
      'Reserved cost-per-event for accepted spans — None → $0.12345678'
    );
    expect(container).toHaveTextContent(
      'Reserved cost-per-event for stored spans — None → $0.87654321'
    );
    expect(container).toHaveTextContent(
      'Reserved budgets — $0.00 for seer budget → $0.00 for seer budget, $50,000.00 for spans budget'
    );
  });

  it('renders reserved budgets to reserved volume', function () {
    const subscription = Am3DsEnterpriseSubscriptionFixture({
      organization: OrganizationFixture(),
      pendingChanges: PendingChangesFixture({
        planDetails: PlanDetailsLookupFixture('am3_business_ent_auf'),
        plan: 'am3_business_ent_auf',
        reserved: {
          spans: 10_000_000,
        },
        reservedCpe: {
          seerAutofix: 1_00,
          seerScanner: 1,
        },
        reservedBudgets: [
          {
            reservedBudget: 0,
            categories: {seerAutofix: true, seerScanner: true},
          },
        ],
      }),
    });

    const {container} = render(<PendingChanges subscription={subscription} />);

    expect(container).toHaveTextContent(
      'Plan changes — Enterprise (Business) → Enterprise (Business)'
    );
    expect(container).toHaveTextContent(
      'Reserved accepted spans — reserved budget → 10,000,000 spans'
    );
    expect(container).toHaveTextContent(
      'Reserved stored spans — reserved budget → 0 spansIndexed'
    );
    expect(container).not.toHaveTextContent('Reserved spans —');
    expect(container).not.toHaveTextContent('Reserved spansIndexed —');

    expect(container).toHaveTextContent(
      'Reserved cost-per-event for spans — $0.01000000 → None'
    );
    expect(container).toHaveTextContent(
      'Reserved cost-per-event for spansIndexed — $0.02000000 → None'
    );
    expect(container).toHaveTextContent(
      'Reserved budgets — $0.00 for seer budget, $100,000.00 for spans budget → $0.00 for seer budget'
    );
  });

  it('does not render reserved budgets if there are no changes', function () {
    const subscription = SubscriptionFixture({
      organization: OrganizationFixture(),
    });
    const {container} = render(<PendingChanges subscription={subscription} />);
    expect(container).not.toHaveTextContent('Reserved budgets —');
  });
});
