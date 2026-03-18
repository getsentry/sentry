import type {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';

export type BreakpointTransaction = Pick<
  NormalizedTrendsTransaction,
  'aggregate_range_1' | 'aggregate_range_2' | 'breakpoint'
>;

export function transformTransaction(
  transaction: BreakpointTransaction
): BreakpointTransaction {
  if (transaction?.breakpoint) {
    return {
      ...transaction,
      breakpoint: transaction.breakpoint * 1000,
    };
  }
  return transaction;
}
