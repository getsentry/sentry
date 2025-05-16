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
export type PendingBudgetProps = Partial<TPendingReservedBudget>;

export function ReservedBudgetCategoryFixture(props: ReservedBudgetCategoryProps) {
  return {
    budgetCategoryType: '',
    name: '',
    docLink: '',
    isFixed: false,
    defaultBudget: 0,
    dataCategories: [],
    productName: '',
    canProductTrial: false,
    ...props,
  };
}

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
    canProductTrial: false,
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

export function SeerReservedBudgetFixture(props: BudgetProps) {
  const defaultProps = {
    id: '',
    reservedBudget: 20_00,
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
    budgetCategoryType: 'SEER',
    name: 'seer budget',
    docLink: '',
    isFixed: true,
    defaultBudget: 20_00,
    dataCategories: [DataCategory.SEER_AUTOFIX, DataCategory.SEER_SCANNER],
    productName: 'seer',
    canProductTrial: true,
    ...props,
  };

  return ReservedBudgetFixture(defaultProps);
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
    budgetCategoryType: 'DYNAMIC_SAMPLING',
    name: 'spans budget',
    docLink: '',
    isFixed: false,
    defaultBudget: null,
    dataCategories: [DataCategory.SPANS, DataCategory.SPANS_INDEXED],
    productName: 'dynamic sampling',
    canProductTrial: false,
    ...props,
  };

  return ReservedBudgetFixture(defaultProps);
}
