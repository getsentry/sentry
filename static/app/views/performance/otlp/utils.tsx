import type {Location} from 'history';

import type {DropdownOption} from 'sentry/components/discover/transactionsList';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {TransactionFilterOptions} from 'sentry/views/performance/transactionSummary/utils';

export function getOTelTransactionsListSort(
  location: Location,
  spanCategory?: string
): {
  options: DropdownOption[];
  selected: DropdownOption;
} {
  const sortOptions = getOTelFilterOptions(spanCategory);
  const urlParam = decodeScalar(
    location.query.showTransactions,
    TransactionFilterOptions.SLOW
  );
  const selectedSort = sortOptions.find(opt => opt.value === urlParam) || sortOptions[0]!;
  return {selected: selectedSort, options: sortOptions};
}

function getOTelFilterOptions(spanCategory?: string): DropdownOption[] {
  return [
    {
      sort: {kind: 'asc', field: 'span.duration'},
      value: TransactionFilterOptions.FASTEST,
      label: spanCategory
        ? t('Fastest %s Service Entry Spans', spanCategory)
        : t('Fastest Service Entry Spans'),
    },
    {
      sort: {kind: 'desc', field: 'span.duration'},
      value: TransactionFilterOptions.SLOW,
      label: spanCategory
        ? t('Slow %s Service Entry Spans (p95)', spanCategory)
        : t('Slow Service Entry Spans (p95)'),
    },
    {
      sort: {kind: 'desc', field: 'span.duration'},
      value: TransactionFilterOptions.OUTLIER,
      label: spanCategory
        ? t('Outlier %s Service Entry Spans (p100)', spanCategory)
        : t('Outlier Service Entry Spans (p100)'),
    },
    {
      sort: {kind: 'desc', field: 'timestamp'},
      value: TransactionFilterOptions.RECENT,
      // The category does not apply to this option
      label: t('Recent Service Entry Spans'),
    },
  ];
}

export const SERVICE_ENTRY_SPANS_CURSOR = 'serviceEntrySpansCursor';
