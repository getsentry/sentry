import type {Location} from 'history';

import type {DropdownOption} from 'sentry/components/discover/transactionsList';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {TransactionFilterOptions} from 'sentry/views/performance/transactionSummary/utils';

export function getEAPSegmentSpansListSort(
  location: Location,
  spanCategory?: string
): {
  options: DropdownOption[];
  selected: DropdownOption;
} {
  const sortOptions = getEAPFilterOptions(spanCategory);
  const urlParam = decodeScalar(
    location.query.showTransactions,
    TransactionFilterOptions.SLOW
  );
  const selectedSort = sortOptions.find(opt => opt.value === urlParam) || sortOptions[0]!;
  return {selected: selectedSort, options: sortOptions};
}

function getEAPFilterOptions(spanCategory?: string): DropdownOption[] {
  return [
    {
      sort: {kind: 'asc', field: 'span.duration'},
      value: TransactionFilterOptions.FASTEST,
      label: spanCategory
        ? t('Fastest %s Transactions', spanCategory)
        : t('Fastest Transactions'),
    },
    {
      sort: {kind: 'desc', field: 'span.duration'},
      value: TransactionFilterOptions.SLOW,
      label: spanCategory
        ? t('Slow %s Transactions (p95)', spanCategory)
        : t('Slow Transactions (p95)'),
    },
    {
      sort: {kind: 'desc', field: 'span.duration'},
      value: TransactionFilterOptions.OUTLIER,
      label: spanCategory
        ? t('Outlier %s Transactions (p100)', spanCategory)
        : t('Outlier Transactions (p100)'),
    },
    {
      sort: {kind: 'desc', field: 'timestamp'},
      value: TransactionFilterOptions.RECENT,
      // The category does not apply to this option
      label: t('Recent Transactions'),
    },
  ];
}

export const SEGMENT_SPANS_CURSOR = 'segmentSpansCursor';
