import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatNumber} from 'sentry/utils/number/formatNumber';
import {QUERY_PAGE_LIMIT} from 'sentry/views/explore/logs/constants';

const ROW_COUNT_VALUE_DEFAULT = 500;

/**
 * Keep this in sync with data_export.py on the backend
 */
export const ROW_COUNT_VALUE_SYNC_LIMIT = QUERY_PAGE_LIMIT;

const ROW_COUNT_VALUES = [
  100,
  ROW_COUNT_VALUE_DEFAULT,
  ROW_COUNT_VALUE_SYNC_LIMIT,
  10_000,
  50_000,
  100_000,
];

export function generateLogExportRowCountOptions(estimatedRowCount: number) {
  const rowCountOptions: Array<SelectValue<number>> = ROW_COUNT_VALUES.map(value => ({
    label: formatNumber(value),
    value,
  })).filter(({value}) => value <= estimatedRowCount);

  if (
    !rowCountOptions.length ||
    (estimatedRowCount > rowCountOptions[rowCountOptions.length - 1]!.value &&
      rowCountOptions.length < ROW_COUNT_VALUES.length)
  ) {
    rowCountOptions.push({
      label: t('%s (All)', formatAbbreviatedNumber(estimatedRowCount)),
      value: estimatedRowCount,
    });
  }

  const rowCountDefault =
    rowCountOptions.find(({value}) => value === ROW_COUNT_VALUE_DEFAULT) ??
    rowCountOptions[0]!;

  return {rowCountOptions, rowCountDefault};
}
