import type {
  ReservedBudgetMetricHistory,
  ReservedBudget as TReservedBudget,
} from 'getsentry/types';

type BudgetProps = Partial<TReservedBudget>;
type MetricHistoryProps = Partial<ReservedBudgetMetricHistory>;

export function ReservedBudgetFixture(props: BudgetProps) {
  return {
    id: '',
    reservedBudget: 0,
    totalReservedSpend: 0,
    freeBudget: 0,
    percentUsed: 0,
    categories: {},
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
