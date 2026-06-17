import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SeerReservedBudgetFixture} from 'getsentry-test/fixtures/reservedBudget';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import {PendingChanges} from 'admin/components/customers/pendingChanges';
import {PendingChangesFixture} from 'getsentry/__fixtures__/pendingChanges';
import {PlanFixture} from 'getsentry/__fixtures__/plan';
import {OnDemandBudgetMode} from 'getsentry/types';

describe('PendingChanges', () => {
  it('renders null pendingChanges)', () => {
    const subscription = SubscriptionFixture({
      organization: OrganizationFixture(),
    });
    const {container} = render(<PendingChanges subscription={subscription} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders empty pendingChanges', () => {
    const subscription = SubscriptionFixture({
      organization: OrganizationFixture(),
      pendingChanges: null,
    });
    const {container} = render(<PendingChanges subscription={subscription} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders pending changes', () => {
    const subscription = SubscriptionFixture({
      organization: OrganizationFixture(),
      customPrice: 0,
      customPricePcss: 0,
      pendingChanges: PendingChangesFixture({
        planDetails: PlanFixture({
          name: 'Team (Enterprise)',
          contractInterval: 'annual',
          billingInterval: 'annual',
          budgetTerm: 'on-demand',
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
    expect(container).toHaveTextContent('On-Demand maximum — $0.00 → $500.00');
  });

  it('renders pending changes with all categories', () => {
    const subscription = SubscriptionFixture({
      organization: OrganizationFixture(),
      customPrice: 0,
      customPricePcss: 0,
      pendingChanges: PendingChangesFixture({
        planDetails: PlanFixture({
          name: 'Team (Enterprise)',
          contractInterval: 'annual',
          billingInterval: 'annual',
          budgetTerm: 'on-demand',
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
    expect(container).toHaveTextContent('On-Demand maximum — $0.00 → $500.00');
  });

  it('renders on-demand budgets', () => {
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
      'On-Demand Budget — shared on-demand budget of $100 → per-category on-demand budget (errors at $3, transactions at $2, and attachments at $1)'
    );
  });

  it('combines regular and on-demand changes', () => {
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
      'On-Demand Budget — shared on-demand budget of $100 → per-category on-demand budget (errors at $3, transactions at $2, and attachments at $1)'
    );
    expect(screen.getAllByText(/The following changes will take effect on/)).toHaveLength(
      1
    );
  });

  it('does not render reserved budgets with mocked values', () => {
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

  it('does not render reserved budgets if there are no changes', () => {
    const subscription = SubscriptionFixture({
      organization: OrganizationFixture(),
    });
    const {container} = render(<PendingChanges subscription={subscription} />);
    expect(container).not.toHaveTextContent('Reserved budgets —');
  });

  it('renders size analysis reserved changes with human-readable name', () => {
    const subscription = SubscriptionFixture({
      organization: OrganizationFixture(),
      pendingChanges: PendingChangesFixture({
        planDetails: PlanDetailsLookupFixture('am3_business'),
        plan: 'am3_business',
        planName: 'Business',
        reserved: {
          sizeAnalyses: 100,
        },
      }),
    });
    subscription.categories = {
      ...subscription.categories,
      sizeAnalyses: MetricHistoryFixture({
        category: 'sizeAnalyses' as any,
        reserved: 50,
      }),
    };

    const {container} = render(<PendingChanges subscription={subscription} />);
    expect(container).toHaveTextContent('Reserved size analysis builds');
    expect(container).toHaveTextContent('50 → 100');
    expect(container).not.toHaveTextContent('sizeAnalyses');
  });
});
