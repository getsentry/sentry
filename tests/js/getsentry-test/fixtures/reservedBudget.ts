import {DataCategory} from 'sentry/types/core';

import type {
  PendingReservedBudget as TPendingReservedBudget,
  ReservedBudget as TReservedBudget,
  ReservedBudgetCategory as TReservedBudgetCategory,
  ReservedBudgetMetricHistory as TReservedBudgetMetricHistory,
} from 'getsentry/types';
import {ReservedBudgetCategoryType} from 'getsentry/types';

type ReservedBudgetCategoryProps = Partial<TReservedBudgetCategory>;
type BudgetProps = Partial<TReservedBudget>;
type MetricHistoryProps = Partial<TReservedBudgetMetricHistory>;
type PendingBudgetProps = Partial<TPendingReservedBudget>;

export function ReservedBudgetFixture(props: BudgetProps) {
  const defaultCategoryProps = {
    apiName: ReservedBudgetCategoryType.DYNAMIC_SAMPLING,
    budgetCategoryType: '',
    name: '',
    docLink: '',
    isFixed: false,
    defaultBudget: null,
    dataCategories: [],
    productName: '',
    productCheckoutName: '',
    canProductTrial: false,
    billingFlag: null,
  };

  return {
    id: '',
    reservedBudget: 0,
    totalReservedSpend: 0,
    freeBudget: 0,
    percentUsed: 0,
    categories: {},
    ...defaultCategoryProps,
    ...props,
  };
}

export function PendingReservedBudgetFixture(props: PendingBudgetProps) {
  return {
    id: '',
    categories: {},
    reservedBudget: 0,
    ...props,
  };
}

export function ReservedBudgetMetricHistoryFixture(props: MetricHistoryProps) {
  return {
    reservedCpe: 0,
    reservedSpend: 0,
    ...props,
  };
}

export function SeerReservedBudgetCategoryFixture(props: ReservedBudgetCategoryProps) {
  return {
    budgetCategoryType: 'SEER',
    apiName: ReservedBudgetCategoryType.SEER,
    billingFlag: 'seer-billing',
    canProductTrial: true,
    name: 'seer budget',
    docLink: 'https://docs.sentry.io/pricing/quotas/manage-seer-budget/',
    isFixed: true,
    defaultBudget: 25_00,
    dataCategories: [DataCategory.SEER_AUTOFIX, DataCategory.SEER_SCANNER],
    productName: 'seer',
    productCheckoutName: 'seer AI agent',
    ...props,
  };
}

export function SeerReservedBudgetFixture(props: BudgetProps) {
  const defaultProps = {
    id: '',
    reservedBudget: 25_00,
    categories: {
      [DataCategory.SEER_AUTOFIX]: ReservedBudgetMetricHistoryFixture({
        reservedCpe: 1_00,
        reservedSpend: 0,
      }),
      [DataCategory.SEER_SCANNER]: ReservedBudgetMetricHistoryFixture({
        reservedCpe: 1,
        reservedSpend: 0,
      }),
    },
    ...SeerReservedBudgetCategoryFixture(props),
    ...props,
  };

  return ReservedBudgetFixture(defaultProps);
}

export function DynamicSamplingReservedBudgetCategoryFixture(
  props: ReservedBudgetCategoryProps
) {
  return {
    budgetCategoryType: 'DYNAMIC_SAMPLING',
    apiName: ReservedBudgetCategoryType.DYNAMIC_SAMPLING,
    billingFlag: null,
    canProductTrial: false,
    name: 'spans budget',
    docLink: '',
    isFixed: false,
    defaultBudget: null,
    dataCategories: [DataCategory.SPANS, DataCategory.SPANS_INDEXED],
    productName: 'dynamic sampling',
    productCheckoutName: 'dynamic sampling',
    ...props,
  };
}

export function DynamicSamplingReservedBudgetFixture(props: BudgetProps) {
  const defaultProps = {
    id: '',
    reservedBudget: 10_000_00, // random values since there are no defaults
    categories: {
      [DataCategory.SPANS]: ReservedBudgetMetricHistoryFixture({
        reservedCpe: 1_000_000,
        reservedSpend: 0,
      }),
      [DataCategory.SPANS_INDEXED]: ReservedBudgetMetricHistoryFixture({
        reservedCpe: 2_000_000,
        reservedSpend: 0,
      }),
    },
    ...DynamicSamplingReservedBudgetCategoryFixture(props),
    ...props,
  };

  return ReservedBudgetFixture(defaultProps);
}
