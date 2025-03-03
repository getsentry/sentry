import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';

import {DataCategory} from 'sentry/types/core';

import type {BillingHistory as TBillingHistory} from 'getsentry/types';
import {OnDemandBudgetMode} from 'getsentry/types';

export function BillingHistoryFixture(
  params: Partial<TBillingHistory> = {}
): TBillingHistory {
  const planData = {plan: 'am1_f', ...params};
  const planDetails = PlanDetailsLookupFixture(planData.plan);

  return {
    id: '625529670',
    isCurrent: true,
    onDemandMaxSpend: 0,
    onDemandSpend: 0,
    onDemandBudgetMode: OnDemandBudgetMode.SHARED,
    plan: planDetails!.id,
    planName: planDetails!.name,
    planDetails: planDetails!,
    periodStart: '2018-01-01',
    periodEnd: '2018-01-31',
    categories: {
      errors: MetricHistoryFixture({
        category: DataCategory.ERRORS,
        reserved: 5_000,
        prepaid: 5_000,
      }),
      transactions: MetricHistoryFixture({
        category: DataCategory.TRANSACTIONS,
        reserved: 10_000,
        prepaid: 10_000,
      }),
      attachments: MetricHistoryFixture({
        category: DataCategory.ATTACHMENTS,
        reserved: 1,
        prepaid: 1,
      }),
    },
    links: {
      csv: 'https://sentry.io/organizations/acme/billing/history/625529670/export/',
      csvPerProject:
        'https://sentry.io/organizations/acme/billing/history/625529670/export/per-project/',
    },
    usage: {
      errors: 0,
      transactions: 0,
      attachments: 0,
    },
    reserved: {
      errors: 5_000,
      transactions: 10_000,
      attachments: 1,
    },
    hasReservedBudgets: false,
    reservedBudgetCategories: [],
    ...params,
  };
}
