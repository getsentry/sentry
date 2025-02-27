import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {BillingHistoryFixture} from 'getsentry-test/fixtures/billingHistory';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {
  Am3DsEnterpriseSubscriptionFixture,
  SubscriptionFixture,
} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import {PreviewDataFixture} from 'getsentry/__fixtures__/previewData';
import {
  GIGABYTE,
  RESERVED_BUDGET_QUOTA,
  UNLIMITED,
  UNLIMITED_ONDEMAND,
  UNLIMITED_RESERVED,
} from 'getsentry/constants';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {OnDemandBudgetMode, PlanTier} from 'getsentry/types';
import UsageHistory from 'getsentry/views/subscriptionPage/usageHistory';

describe('Subscription > UsageHistory', () => {
  const billingOrg = OrganizationFixture({access: ['org:billing']});

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM1),
    });
    MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/subscription/preview/`,
      method: 'GET',
      body: PreviewDataFixture({}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${billingOrg.slug}/members/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${billingOrg.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/plan-migrations/`,
      query: {scheduled: 1, applied: 0},
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${billingOrg.slug}/prompts-activity/`,
      body: {},
    });
  });

  it('shows an error for non-billing roles', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [BillingHistoryFixture()],
    });

    const org = OrganizationFixture();
    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization: org,
    });
    SubscriptionStore.set(org.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={org} />);
    expect(await screen.findByTestId('permission-denied')).toBeInTheDocument();
  });

  it('shows the tab when user is a billing admin', function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [BillingHistoryFixture()],
    });

    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);
    expect(screen.queryByTestId('permission-denied')).not.toBeInTheDocument();
    expect(mockCall).toHaveBeenCalled();
  });

  it('shows expanders for details, and they work', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [BillingHistoryFixture()],
    });

    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);
    expect(mockCall).toHaveBeenCalled();

    // Expand button should be present.
    expect(await screen.findByTestId('history-expand')).toBeInTheDocument();

    // Details are expanded for the current item
    expect(
      screen.getByRole('row', {name: 'Type Accepted Reserved Used (%)'})
    ).toBeInTheDocument();

    // Click the expander and hide the details.
    await userEvent.click(screen.getByLabelText('Expand history'));
    expect(
      screen.queryByRole('row', {name: 'Type Accepted Reserved Used (%)'})
    ).not.toBeInTheDocument();
  });

  it('hides on-demand when it is not relevant', function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [BillingHistoryFixture()],
    });

    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    expect(screen.queryByText('On-demand Spend')).not.toBeInTheDocument();
    expect(mockCall).toHaveBeenCalled();
  });

  it('overage is shown as >100%', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [
        BillingHistoryFixture({
          categories: {
            errors: MetricHistoryFixture({
              usage: 1001,
              reserved: 1000,
              prepaid: 1000,
            }),
            transactions: MetricHistoryFixture({
              category: DataCategory.TRANSACTIONS,
              reserved: 1000,
              prepaid: 1000,
            }),
            attachments: MetricHistoryFixture({
              category: DataCategory.ATTACHMENTS,
              reserved: 1,
              prepaid: 1,
            }),
          },
          reserved: {errors: 1000, transactions: 1000, attachments: 1},
          usage: {errors: 1001, transactions: 0, attachments: 0},
        }),
      ],
    });

    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);
    expect(await screen.findByText('>100%')).toBeInTheDocument();
    expect(screen.queryByText('Gifted')).not.toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '1 GB'})).toBeInTheDocument();
  });

  it('shows gifted when relevant', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [
        BillingHistoryFixture({
          categories: {
            errors: MetricHistoryFixture({
              usage: 1001,
              free: 2,
              reserved: 1000,
              prepaid: 1002,
            }),
            transactions: MetricHistoryFixture({
              category: DataCategory.TRANSACTIONS,
              reserved: 1000,
              prepaid: 1000,
            }),
            attachments: MetricHistoryFixture({
              category: DataCategory.ATTACHMENTS,
              reserved: 1,
              prepaid: 1,
            }),
          },
          reserved: {errors: 1000, transactions: 1000, attachments: 1},
          usage: {errors: 1001, transactions: 0, attachments: 0},
        }),
      ],
    });

    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);
    expect(await screen.findByText('Gifted')).toBeInTheDocument();
    expect(screen.queryByText('>100%')).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', {name: '∞'})).not.toBeInTheDocument();
  });

  it('displays shared on-demand when relevant', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [
        BillingHistoryFixture({
          id: '123',
          onDemandMaxSpend: 1000,
          onDemandSpend: 500,
          onDemandBudgetMode: OnDemandBudgetMode.SHARED,
          categories: {
            errors: MetricHistoryFixture({
              onDemandBudget: 1000,
              onDemandSpendUsed: 300,
            }),
            transactions: MetricHistoryFixture({
              category: DataCategory.TRANSACTIONS,
              onDemandBudget: 1000,
              onDemandSpendUsed: 150,
            }),
            attachments: MetricHistoryFixture({
              category: DataCategory.ATTACHMENTS,
              onDemandBudget: 1000,
              onDemandSpendUsed: 50,
            }),
          },
        }),
      ],
    });
    const subscription = SubscriptionFixture({
      plan: 'am1_team',
      planTier: PlanTier.AM1,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    // Shared On-demand should show up
    expect(await screen.findByText('On-Demand Spend (Shared)')).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Total $5.00 $10.00 50%'})).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Errors $3.00 \u2014 30%'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Transactions $1.50 \u2014 15%'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Attachments $0.50 \u2014 5%'})
    ).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Total $5.00 $10.00 50%'})).toBeInTheDocument();
    expect(mockCall).toHaveBeenCalled();
  });

  it('displays per-category on-demand when relevant', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [
        BillingHistoryFixture({
          id: '123',
          onDemandMaxSpend: 1000,
          onDemandSpend: 500,
          onDemandBudgetMode: OnDemandBudgetMode.PER_CATEGORY,
          categories: {
            errors: MetricHistoryFixture({
              onDemandBudget: 500,
              onDemandSpendUsed: 300,
            }),
            transactions: MetricHistoryFixture({
              category: DataCategory.TRANSACTIONS,
              onDemandBudget: 500,
              onDemandSpendUsed: 200,
            }),
            attachments: MetricHistoryFixture({
              category: DataCategory.ATTACHMENTS,
            }),
          },
        }),
      ],
    });
    const subscription = SubscriptionFixture({
      plan: 'am1_team',
      planTier: PlanTier.AM1,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    // Per-category On-demand should show up
    expect(await screen.findByText('On-Demand Spend (Per-Category)')).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Total $5.00 $10.00 50%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Errors $3.00 $5.00 60%'})).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Transactions $2.00 $5.00 40%'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Attachments $0.00 $0.00 0%'})
    ).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Total $5.00 $10.00 50%'})).toBeInTheDocument();
    expect(mockCall).toHaveBeenCalled();
  });

  it('displays historical usage for unlimited on-demand', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [
        BillingHistoryFixture({
          onDemandMaxSpend: UNLIMITED_ONDEMAND,
          onDemandSpend: 2222,
        }),
      ],
    });
    const subscription = SubscriptionFixture({
      plan: 'am1_team',
      planTier: PlanTier.AM1,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    expect(await screen.findByText('On-Demand Spend (Shared)')).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: `Total $22.22 ${UNLIMITED} 0%`})
    ).toBeInTheDocument();
    expect(mockCall).toHaveBeenCalled();
  });

  it('displays soft cap per-category on-demand when relevant', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [
        BillingHistoryFixture({
          id: '123',
          onDemandMaxSpend: 1000,
          onDemandSpend: 500,
          onDemandBudgetMode: OnDemandBudgetMode.PER_CATEGORY,
          categories: {
            errors: MetricHistoryFixture({
              category: DataCategory.ERRORS,
              softCapType: 'ON_DEMAND',
            }),
            transactions: MetricHistoryFixture({
              category: DataCategory.TRANSACTIONS,
              softCapType: 'ON_DEMAND',
            }),
            attachments: MetricHistoryFixture({
              category: DataCategory.ATTACHMENTS,
              softCapType: 'ON_DEMAND',
            }),
          },
        }),
      ],
    });
    const subscription = SubscriptionFixture({
      plan: 'am1_team',
      planTier: PlanTier.AM1,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    // Per-category Soft Cap On-demand should show up
    expect(await screen.findAllByText('Errors (On Demand)')).toHaveLength(2);
    expect(screen.getAllByText('Transactions (On Demand)')).toHaveLength(2);
    expect(screen.getAllByText('Attachments (On Demand)')).toHaveLength(2);
    expect(mockCall).toHaveBeenCalled();
  });

  it('displays soft cap per-category true forward when relevant', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [
        BillingHistoryFixture({
          id: '123',
          onDemandMaxSpend: 1000,
          onDemandSpend: 500,
          onDemandBudgetMode: OnDemandBudgetMode.PER_CATEGORY,
          categories: {
            errors: MetricHistoryFixture({
              category: DataCategory.ERRORS,
              softCapType: 'TRUE_FORWARD',
            }),
            transactions: MetricHistoryFixture({
              category: DataCategory.TRANSACTIONS,
              softCapType: 'TRUE_FORWARD',
            }),
            attachments: MetricHistoryFixture({
              category: DataCategory.ATTACHMENTS,
              softCapType: null,
            }),
          },
        }),
      ],
    });
    const subscription = SubscriptionFixture({
      plan: 'am1_team',
      planTier: PlanTier.AM1,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    // Per-category Soft Cap True Forward should show up
    expect(await screen.findAllByText('Errors (True Forward)')).toHaveLength(2);
    expect(screen.getAllByText('Transactions (True Forward)')).toHaveLength(2);
    expect(screen.queryByText('Attachments (True Forward)')).not.toBeInTheDocument();
    expect(mockCall).toHaveBeenCalled();
  });

  // Ensure orgs with True Forward set prior to the soft cap types will display correctly
  it('displays per-category true forward without soft cap when relevant', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [
        BillingHistoryFixture({
          id: '123',
          onDemandMaxSpend: 1000,
          onDemandSpend: 500,
          onDemandBudgetMode: OnDemandBudgetMode.PER_CATEGORY,
          categories: {
            errors: MetricHistoryFixture({
              category: DataCategory.ERRORS,
              trueForward: true,
            }),
            transactions: MetricHistoryFixture({
              category: DataCategory.TRANSACTIONS,
              trueForward: false,
            }),
            attachments: MetricHistoryFixture({
              category: DataCategory.ATTACHMENTS,
              trueForward: true,
            }),
          },
        }),
      ],
    });
    const subscription = SubscriptionFixture({
      plan: 'am1_team',
      planTier: PlanTier.AM1,
      organization: billingOrg,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    // Per-category True Forward should show up
    expect(await screen.findAllByText('Errors (True Forward)')).toHaveLength(2);
    expect(screen.getAllByText('Attachments (True Forward)')).toHaveLength(2);
    expect(screen.queryByText('Transactions (True Forward)')).not.toBeInTheDocument();
    expect(mockCall).toHaveBeenCalled();
  });

  it('displays attachments correctly for am1 plan', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [
        BillingHistoryFixture({
          categories: {
            errors: MetricHistoryFixture({
              prepaid: 100_000,
              reserved: 50_000,
            }),
            transactions: MetricHistoryFixture({
              category: DataCategory.TRANSACTIONS,
              prepaid: 100_000,
              reserved: 100_000,
            }),
            attachments: MetricHistoryFixture({
              category: DataCategory.ATTACHMENTS,
              prepaid: 1,
              usage: 0.4 * GIGABYTE,
              reserved: 1,
            }),
          },
        }),
      ],
    });

    const subscription = SubscriptionFixture({
      organization: billingOrg,
      plan: 'am1_team',
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    expect(
      await screen.findByRole('row', {
        name: /attachments/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '1 GB'})).toBeInTheDocument();
    expect(screen.queryByRole('cell', {name: '∞'})).not.toBeInTheDocument();
    expect(mockCall).toHaveBeenCalled();
  });

  it('displays attachments correctly for mm2 plan', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [
        BillingHistoryFixture({
          categories: {
            errors: MetricHistoryFixture({
              reserved: 100_000,
              free: 10_000,
              prepaid: 110_000,
            }),
            transactions: MetricHistoryFixture({
              category: DataCategory.TRANSACTIONS,
              reserved: null,
            }),
            attachments: MetricHistoryFixture({
              category: DataCategory.ATTACHMENTS,
              usage: GIGABYTE * 0.5,
              reserved: null,
            }),
          },
        }),
      ],
    });

    const subscription = SubscriptionFixture({
      organization: billingOrg,
      plan: 'mm2_b_100k',
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    expect(
      await screen.findByRole('row', {
        name: /attachments/i,
      })
    ).toBeInTheDocument();

    expect(screen.getAllByRole('cell', {name: '0 GB'})).toHaveLength(2);
    expect(screen.getByRole('cell', {name: '500 MB'})).toBeInTheDocument();
    expect(screen.queryByRole('cell', {name: '∞'})).not.toBeInTheDocument();
    expect(mockCall).toHaveBeenCalled();
  });

  it('displays performance units for am2 plan', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [BillingHistoryFixture({plan: 'am2_f'})],
    });

    const subscription = SubscriptionFixture({organization: billingOrg, plan: 'am2_f'});
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    expect(
      await screen.findByRole('row', {
        name: /performance units/i,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/transactions/i)).not.toBeInTheDocument();
    expect(mockCall).toHaveBeenCalled();
  });

  it('displays transactions for am1 plan', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [BillingHistoryFixture({plan: 'am1_f'})],
    });

    const subscription = SubscriptionFixture({organization: billingOrg, plan: 'am1_f'});
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    expect(
      await screen.findByRole('row', {
        name: /transactions/i,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/performance units/i)).not.toBeInTheDocument();
    expect(mockCall).toHaveBeenCalled();
  });

  it('displays spans for am3 DS without custom dynamic sampling', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [
        BillingHistoryFixture({
          plan: 'am3_business_ent_ds_auf',
          categories: {
            spans: MetricHistoryFixture({
              category: DataCategory.SPANS,
              prepaid: RESERVED_BUDGET_QUOTA,
              reserved: RESERVED_BUDGET_QUOTA,
            }),
            spansIndexed: MetricHistoryFixture({
              category: DataCategory.SPANS_INDEXED,
              prepaid: RESERVED_BUDGET_QUOTA,
              reserved: RESERVED_BUDGET_QUOTA,
            }),
          },
        }),
      ],
    });

    const subscription = Am3DsEnterpriseSubscriptionFixture({organization: billingOrg});
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    expect(
      await screen.findByRole('row', {
        name: /spans/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.queryByText(/accepted spans/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stored spans/i)).not.toBeInTheDocument();
    expect(mockCall).toHaveBeenCalled();
  });

  it('displays accepted and stored spans for am3 DS with custom dynamic sampling', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [
        BillingHistoryFixture({
          plan: 'am3_business_ent_ds_auf',
          categories: {
            spans: MetricHistoryFixture({
              category: DataCategory.SPANS,
              prepaid: RESERVED_BUDGET_QUOTA,
              reserved: RESERVED_BUDGET_QUOTA,
            }),
            spansIndexed: MetricHistoryFixture({
              category: DataCategory.SPANS_INDEXED,
              prepaid: RESERVED_BUDGET_QUOTA,
              reserved: RESERVED_BUDGET_QUOTA,
            }),
          },
        }),
      ],
    });

    const subscription = Am3DsEnterpriseSubscriptionFixture({
      organization: billingOrg,
      hadCustomDynamicSampling: true,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    expect(
      await screen.findByRole('row', {
        name: /accepted spans/i,
      })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('row', {
        name: /stored spans/i,
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText('N/A')).toHaveLength(2);
    expect(mockCall).toHaveBeenCalled();
  });

  it('displays spans for am3 DS trial without custom dynamic sampling', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [
        BillingHistoryFixture({
          plan: 'am3_t_ent_ds',
          categories: {
            spans: MetricHistoryFixture({
              category: DataCategory.SPANS,
              prepaid: UNLIMITED_RESERVED,
              reserved: UNLIMITED_RESERVED,
            }),
            spansIndexed: MetricHistoryFixture({
              category: DataCategory.SPANS_INDEXED,
              prepaid: UNLIMITED_RESERVED,
              reserved: UNLIMITED_RESERVED,
            }),
          },
        }),
      ],
    });

    const subscription = Am3DsEnterpriseSubscriptionFixture({organization: billingOrg});
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    expect(
      await screen.findByRole('row', {
        name: /spans/i,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
    expect(screen.queryByText(/accepted spans/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stored spans/i)).not.toBeInTheDocument();
    expect(mockCall).toHaveBeenCalled();
  });

  it('displays accepted and stored spans for am3 DS trial with custom dynamic sampling', async function () {
    const mockCall = MockApiClient.addMockResponse({
      url: `/customers/${billingOrg.slug}/history/`,
      method: 'GET',
      body: [
        BillingHistoryFixture({
          plan: 'am3_t_ent_ds',
          categories: {
            spans: MetricHistoryFixture({
              category: DataCategory.SPANS,
              prepaid: UNLIMITED_RESERVED,
              reserved: UNLIMITED_RESERVED,
            }),
            spansIndexed: MetricHistoryFixture({
              category: DataCategory.SPANS_INDEXED,
              prepaid: UNLIMITED_RESERVED,
              reserved: UNLIMITED_RESERVED,
            }),
          },
        }),
      ],
    });

    const subscription = Am3DsEnterpriseSubscriptionFixture({
      organization: billingOrg,
      hadCustomDynamicSampling: true,
    });
    SubscriptionStore.set(billingOrg.slug, subscription);

    render(<UsageHistory {...RouteComponentPropsFixture()} organization={billingOrg} />);

    expect(
      await screen.findByRole('row', {
        name: /accepted spans/i,
      })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('row', {
        name: /stored spans/i,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();

    expect(mockCall).toHaveBeenCalled();
  });
});
