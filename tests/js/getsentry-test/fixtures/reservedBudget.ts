import {DataCategory} from 'sentry/types/core';

import type {
  ReservedBudget as TReservedBudget,
  ReservedBudgetCategory as TReservedBudgetCategory,
  ReservedBudgetMetricHistory as TReservedBudgetMetricHistory,
} from 'getsentry/types';

type ReservedBudgetCategoryProps = Partial<TReservedBudgetCategory>;
type BudgetProps = Partial<TReservedBudget>;
type MetricHistoryProps = Partial<TReservedBudgetMetricHistory>;

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
  const infoProps = props.info ?? {};
  return {
    id: '',
    reservedBudget: 0,
    totalReservedSpend: 0,
    freeBudget: 0,
    percentUsed: 0,
    categories: {},
    info: ReservedBudgetCategoryFixture(infoProps),
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
  const infoProps = props.info ?? {
    budgetCategoryType: 'SEER',
    name: 'seer budget',
    docLink: '',
    isFixed: true,
    defaultBudget: 20_00,
    dataCategories: [DataCategory.SEER_AUTOFIX, DataCategory.SEER_SCANNER],
    productName: 'seer',
    canProductTrial: false,
  };
  const defaultProps = {
    id: '',
    reservedBudget: 20_00,
    info: infoProps,
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
    ...props,
  };

  return ReservedBudgetFixture(defaultProps);
}
