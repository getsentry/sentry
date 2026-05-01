import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatNumber} from 'sentry/utils/number/formatNumber';
import {QUERY_PAGE_LIMIT} from 'sentry/views/explore/logs/constants';

const ROW_COUNT_VALUE_DEFAULT = 100;

/**
 * Keep this in sync with data_export.py on the backend
 */
export const ROW_COUNT_VALUE_SYNC_LIMIT = QUERY_PAGE_LIMIT;

const ROW_COUNT_VALUES = [
  ROW_COUNT_VALUE_DEFAULT,
  500,
  ROW_COUNT_VALUE_SYNC_LIMIT,
  10_000,
  50_000,
  100_000,
];

export function generateLogExportRowCountOptions(
  estimatedRowCount: number
): Array<SelectValue<number>> {
  const rowOptions: Array<SelectValue<number>> = ROW_COUNT_VALUES.map(value => ({
    label: formatNumber(value),
    value,
  })).filter(({value}) => value <= estimatedRowCount);

  if (
    !rowOptions.length ||
    (estimatedRowCount > rowOptions[rowOptions.length - 1]!.value &&
      rowOptions.length < ROW_COUNT_VALUES.length)
  ) {
    rowOptions.push({
      label: t('%s (All)', formatAbbreviatedNumber(estimatedRowCount)),
      value: estimatedRowCount,
    });
  }

  return rowOptions;
}
