import type {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';

export default function transformTransaction(
  transaction: NormalizedTrendsTransaction
): NormalizedTrendsTransaction {
  if (transaction?.breakpoint) {
    return {
      ...transaction,
      breakpoint: transaction.breakpoint * 1000,
    };
  }
  return transaction;
}
