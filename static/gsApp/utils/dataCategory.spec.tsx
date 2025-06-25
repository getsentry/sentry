import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {
  DynamicSamplingReservedBudgetFixture,
  PendingReservedBudgetFixture,
  ReservedBudgetFixture,
  ReservedBudgetMetricHistoryFixture,
  SeerReservedBudgetFixture,
} from 'getsentry-test/fixtures/reservedBudget';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import {DataCategory} from 'sentry/types/core';

import {
  getPlanCategoryName,
  getReservedBudgetDisplayName,
  hasCategoryFeature,
  isSeer,
  listDisplayNames,
  sortCategories,
  sortCategoriesWithKeys,
} from 'getsentry/utils/dataCategory';

describe('hasCategoryFeature', function () {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization, plan: 'mm2_b_100k'});

  it('returns am1 plan categories', function () {
    const sub = SubscriptionFixture({organization, plan: 'am1_team'});
    expect(hasCategoryFeature(DataCategory.ERRORS, sub, organization)).toBe(true);
    expect(hasCategoryFeature(DataCategory.TRANSACTIONS, sub, organization)).toBe(true);
    expect(hasCategoryFeature(DataCategory.ATTACHMENTS, sub, organization)).toBe(true);
    expect(hasCategoryFeature(DataCategory.REPLAYS, sub, organization)).toBe(true);
    expect(hasCategoryFeature(DataCategory.MONITOR_SEATS, sub, organization)).toBe(true);
  });

  it('returns mm2 plan categories', function () {
    expect(hasCategoryFeature(DataCategory.ERRORS, subscription, organization)).toBe(
      true
    );
    expect(
      hasCategoryFeature(DataCategory.TRANSACTIONS, subscription, organization)
    ).toBe(false);
    expect(hasCategoryFeature(DataCategory.ATTACHMENTS, subscription, organization)).toBe(
      false
    );
    expect(hasCategoryFeature(DataCategory.REPLAYS, subscription, organization)).toBe(
      false
    );
    expect(
      hasCategoryFeature(DataCategory.MONITOR_SEATS, subscription, organization)
    ).toBe(false);
  });

  it('returns mm1 plan categories', function () {
    const sub = SubscriptionFixture({organization, plan: 's1'});
    expect(hasCategoryFeature(DataCategory.ERRORS, sub, organization)).toBe(true);
    expect(hasCategoryFeature(DataCategory.TRANSACTIONS, sub, organization)).toBe(false);
    expect(hasCategoryFeature(DataCategory.ATTACHMENTS, sub, organization)).toBe(false);
    expect(hasCategoryFeature(DataCategory.REPLAYS, subscription, organization)).toBe(
      false
    );
    expect(
      hasCategoryFeature(DataCategory.MONITOR_SEATS, subscription, organization)
    ).toBe(false);
  });

  it('returns org has transactions feature', function () {
    const org = {...organization, features: ['performance-view']};
    expect(hasCategoryFeature(DataCategory.ERRORS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.TRANSACTIONS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.ATTACHMENTS, subscription, org)).toBe(false);
    expect(hasCategoryFeature(DataCategory.REPLAYS, subscription, org)).toBe(false);
    expect(hasCategoryFeature(DataCategory.MONITOR_SEATS, subscription, org)).toBe(false);
  });

  it('returns org has attachments feature', function () {
    const org = {...organization, features: ['event-attachments']};
    expect(hasCategoryFeature(DataCategory.ERRORS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.TRANSACTIONS, subscription, org)).toBe(false);
    expect(hasCategoryFeature(DataCategory.ATTACHMENTS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.REPLAYS, subscription, org)).toBe(false);
    expect(hasCategoryFeature(DataCategory.MONITOR_SEATS, subscription, org)).toBe(false);
  });

  it('returns org has replays feature', function () {
    const org = {...organization, features: ['session-replay']};
    expect(hasCategoryFeature(DataCategory.ERRORS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.TRANSACTIONS, subscription, org)).toBe(false);
    expect(hasCategoryFeature(DataCategory.ATTACHMENTS, subscription, org)).toBe(false);
    expect(hasCategoryFeature(DataCategory.REPLAYS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.MONITOR_SEATS, subscription, org)).toBe(false);
  });

  it('returns org has transactions and attachments features', function () {
    const org = {...organization, features: ['performance-view', 'event-attachments']};
    expect(hasCategoryFeature(DataCategory.ERRORS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.TRANSACTIONS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.ATTACHMENTS, subscription, org)).toBe(true);
    expect(hasCategoryFeature(DataCategory.REPLAYS, subscription, org)).toBe(false);
    expect(hasCategoryFeature(DataCategory.REPLAYS, subscription, org)).toBe(false);
  });

  it('returns org does not have unknown feature', function () {
    const org = {...organization, features: []};
    expect(hasCategoryFeature('unknown' as DataCategory, subscription, org)).toBe(false);
  });

  it('returns sorted categories', function () {
    const sub = SubscriptionFixture({organization, plan: 'am1_team'});
    expect(sortCategories(sub.categories)).toStrictEqual([
      MetricHistoryFixture({
        category: DataCategory.ERRORS,
        reserved: 50_000,
        prepaid: 50_000,
        order: 1,
      }),
      MetricHistoryFixture({
        category: DataCategory.TRANSACTIONS,
        reserved: 100_000,
        prepaid: 100_000,
        order: 2,
      }),
      MetricHistoryFixture({
        category: DataCategory.REPLAYS,
        reserved: 500,
        prepaid: 500,
        order: 4,
      }),
      MetricHistoryFixture({
        category: DataCategory.MONITOR_SEATS,
        reserved: 1,
        prepaid: 1,
        order: 7,
      }),
      MetricHistoryFixture({
        category: DataCategory.UPTIME,
        reserved: 1,
        prepaid: 1,
        order: 8,
      }),
      MetricHistoryFixture({
        category: DataCategory.ATTACHMENTS,
        reserved: 1,
        prepaid: 1,
        order: 9,
      }),
      MetricHistoryFixture({
        category: DataCategory.SEER_AUTOFIX,
        reserved: 0,
        prepaid: 0,
        order: 14,
      }),
      MetricHistoryFixture({
        category: DataCategory.SEER_SCANNER,
        reserved: 0,
        prepaid: 0,
        order: 15,
      }),
    ]);
  });

  it('returns sorted categories with keys', function () {
    const sub = SubscriptionFixture({organization, plan: 'am1_team'});
    expect(sortCategoriesWithKeys(sub.categories)).toStrictEqual([
      [
        'errors',
        MetricHistoryFixture({
          category: DataCategory.ERRORS,
          reserved: 50_000,
          prepaid: 50_000,
          order: 1,
        }),
      ],
      [
        'transactions',
        MetricHistoryFixture({
          category: DataCategory.TRANSACTIONS,
          reserved: 100_000,
          prepaid: 100_000,
          order: 2,
        }),
      ],
      [
        'replays',
        MetricHistoryFixture({
          category: DataCategory.REPLAYS,
          reserved: 500,
          prepaid: 500,
          order: 4,
        }),
      ],
      [
        'monitorSeats',
        MetricHistoryFixture({
          category: DataCategory.MONITOR_SEATS,
          reserved: 1,
          prepaid: 1,
          order: 7,
        }),
      ],
      [
        'uptime',
        MetricHistoryFixture({
          category: DataCategory.UPTIME,
          reserved: 1,
          prepaid: 1,
          order: 8,
        }),
      ],
      [
        'attachments',
        MetricHistoryFixture({
          category: DataCategory.ATTACHMENTS,
          reserved: 1,
          prepaid: 1,
          order: 9,
        }),
      ],
      [
        'seerAutofix',
        MetricHistoryFixture({
          category: DataCategory.SEER_AUTOFIX,
          reserved: 0,
          prepaid: 0,
          order: 14,
        }),
      ],
      [
        'seerScanner',
        MetricHistoryFixture({
          category: DataCategory.SEER_SCANNER,
          reserved: 0,
          prepaid: 0,
          order: 15,
        }),
      ],
    ]);
  });
});

describe('getPlanCategoryName', function () {
  const plan = PlanDetailsLookupFixture('am3_team');

  it('should capitalize category', function () {
    expect(getPlanCategoryName({plan, category: DataCategory.TRANSACTIONS})).toBe(
      'Transactions'
    );
    expect(getPlanCategoryName({plan, category: DataCategory.ERRORS})).toBe('Errors');
    expect(getPlanCategoryName({plan, category: DataCategory.REPLAYS})).toBe('Replays');
    expect(getPlanCategoryName({plan, category: DataCategory.SPANS})).toBe('Spans');
    expect(getPlanCategoryName({plan, category: DataCategory.PROFILE_DURATION})).toBe(
      'Continuous profile hours'
    );
    expect(getPlanCategoryName({plan, category: DataCategory.MONITOR_SEATS})).toBe(
      'Cron monitors'
    );
  });

  it('should display spans as accepted spans for DS', function () {
    expect(
      getPlanCategoryName({
        plan,
        category: DataCategory.SPANS,
        hadCustomDynamicSampling: true,
      })
    ).toBe('Accepted spans');
  });
});

describe('getReservedBudgetDisplayName', function () {
  const am3DsPlan = PlanDetailsLookupFixture('am3_business_ent_ds_auf');

  it('should use the reserved budget name if it exists', function () {
    expect(
      getReservedBudgetDisplayName({
        plan: am3DsPlan,
        reservedBudget: DynamicSamplingReservedBudgetFixture({}),
      })
    ).toBe('spans budget');

    expect(
      getReservedBudgetDisplayName({
        plan: am3DsPlan,
        reservedBudget: SeerReservedBudgetFixture({}),
        shouldTitleCase: true,
      })
    ).toBe('Seer Budget');
  });

  it('should try to find the reserved budget name if it does not exist', function () {
    expect(
      getReservedBudgetDisplayName({
        plan: am3DsPlan,
        pendingReservedBudget: PendingReservedBudgetFixture({
          categories: {
            [DataCategory.SPANS]: true,
            [DataCategory.SPANS_INDEXED]: true,
          },
          reservedBudget: 1000,
        }),
      })
    ).toBe('spans budget');
  });

  it('should oxfordize the budget categories if no name exists or can be found', function () {
    expect(
      getReservedBudgetDisplayName({
        plan: am3DsPlan,
        pendingReservedBudget: PendingReservedBudgetFixture({
          categories: {
            [DataCategory.SPANS_INDEXED]: true,
          },
          reservedBudget: 1000,
        }),
      })
    ).toBe('stored spans budget');

    expect(
      getReservedBudgetDisplayName({
        plan: am3DsPlan,
        reservedBudget: ReservedBudgetFixture({
          categories: {
            [DataCategory.REPLAYS]: ReservedBudgetMetricHistoryFixture({}),
          },
          dataCategories: [DataCategory.REPLAYS],
        }),
      })
    ).toBe('replays budget');

    expect(
      getReservedBudgetDisplayName({
        plan: am3DsPlan,
        pendingReservedBudget: PendingReservedBudgetFixture({
          categories: {
            [DataCategory.ERRORS]: true,
            [DataCategory.SPANS]: true,
            [DataCategory.REPLAYS]: true,
            [DataCategory.MONITOR_SEATS]: true,
          },
          reservedBudget: 1000,
        }),
      })
    ).toBe('cron monitors, errors, replays, and spans budget'); // alphabetically sorted

    expect(
      getReservedBudgetDisplayName({
        plan: am3DsPlan,
        reservedBudget: ReservedBudgetFixture({
          categories: {
            [DataCategory.ATTACHMENTS]: ReservedBudgetMetricHistoryFixture({}),
            [DataCategory.UPTIME]: ReservedBudgetMetricHistoryFixture({}),
          },
          dataCategories: [DataCategory.ATTACHMENTS, DataCategory.UPTIME],
        }),
      })
    ).toBe('attachments and uptime monitors budget');
  });
});

describe('listDisplayNames', function () {
  const plan = PlanDetailsLookupFixture('am3_business_ent_ds_auf');

  it('should list categories in order given', function () {
    expect(
      listDisplayNames({
        plan: plan!,
        categories: [
          DataCategory.SPANS,
          DataCategory.TRANSACTIONS,
          DataCategory.ERRORS,
          DataCategory.REPLAYS,
          DataCategory.MONITOR_SEATS,
          DataCategory.ATTACHMENTS,
        ],
      })
    ).toBe('spans, transactions, errors, replays, cron monitors, and attachments');
  });

  it('should hide stored spans for no DS', function () {
    expect(
      listDisplayNames({
        plan: plan!,
        categories: plan!.checkoutCategories,
        hadCustomDynamicSampling: false,
      })
    ).toBe('errors, replays, attachments, cron monitors, spans, and uptime monitors');
  });

  it('should include stored spans and use accepted spans for DS', function () {
    expect(
      listDisplayNames({
        plan: plan!,
        categories: plan!.checkoutCategories,
        hadCustomDynamicSampling: true,
      })
    ).toBe(
      'errors, replays, attachments, cron monitors, accepted spans, uptime monitors, and stored spans'
    );
  });
});

describe('isSeer', () => {
  it.each([
    [DataCategory.SEER_AUTOFIX, true],
    [DataCategory.SEER_SCANNER, true],
    [DataCategory.ERRORS, false],
    [DataCategory.TRANSACTIONS, false],
  ])('returns %s for category %s', (category, expected) => {
    expect(isSeer(category)).toBe(expected);
  });
});
