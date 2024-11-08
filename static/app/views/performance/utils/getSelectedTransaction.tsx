import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';
import type {
  NormalizedTrendsTransaction,
  TrendChangeType,
} from 'sentry/views/performance/trends/types';
import getSelectedQueryKey from 'sentry/views/performance/trends/utils/getSelectedQueryKey';

export function getSelectedTransaction(
  location: Location,
  trendChangeType: TrendChangeType,
  transactions?: NormalizedTrendsTransaction[]
): NormalizedTrendsTransaction | undefined {
  const queryKey = getSelectedQueryKey(trendChangeType);
  const selectedTransactionName = decodeScalar(location.query[queryKey]);

  if (!transactions) {
    return undefined;
  }

  const selectedTransaction = transactions.find(
    transaction =>
      `${transaction.transaction}-${transaction.project}` === selectedTransactionName
  );

  if (selectedTransaction) {
    return selectedTransaction;
  }

  return transactions.length > 0 ? transactions[0] : undefined;
}
