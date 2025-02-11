import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import {DataCategory} from 'sentry/types/core';

import {
  getPlanCategoryName,
  hasCategoryFeature,
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
    expect(hasCategoryFeature('unknown', subscription, org)).toBe(false);
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
        category: DataCategory.ATTACHMENTS,
        reserved: 1,
        prepaid: 1,
        order: 8,
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
        'attachments',
        MetricHistoryFixture({
          category: DataCategory.ATTACHMENTS,
          reserved: 1,
          prepaid: 1,
          order: 8,
        }),
      ],
    ]);
  });
});

describe('getPlanCategoryName', function () {
  const plan = PlanDetailsLookupFixture('am3_team');

  it('should capitalize category', function () {
    expect(getPlanCategoryName({plan, category: 'transactions'})).toBe('Transactions');
    expect(getPlanCategoryName({plan, category: 'errors'})).toBe('Errors');
    expect(getPlanCategoryName({plan, category: 'replays'})).toBe('Replays');
    expect(getPlanCategoryName({plan, category: 'spans'})).toBe('Spans');
    expect(getPlanCategoryName({plan, category: 'profiles'})).toBe('Profiles');
    expect(getPlanCategoryName({plan, category: 'monitorSeats'})).toBe('Cron monitors');
  });
});
