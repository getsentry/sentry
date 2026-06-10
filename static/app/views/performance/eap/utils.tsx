import type {Location} from 'history';

import type {DropdownOption} from 'sentry/components/discover/transactionsList';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import type {SegmentSpansColumn} from 'sentry/views/performance/eap/types';
import {TransactionFilterOptions} from 'sentry/views/performance/transactionSummary/utils';

export const SEGMENT_SPANS_COLUMN_ORDER: SegmentSpansColumn[] = [
  {
    key: 'trace',
    name: t('Trace ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'span_id',
    name: t('Span ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'user.display',
    name: t('User'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'span.duration',
    name: t('Total Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'timestamp',
    name: t('Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'replayId',
    name: t('Replay'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'profile.id',
    name: t('Profile'),
    width: COL_WIDTH_UNDEFINED,
  },
];

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
