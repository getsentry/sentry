import type {SelectValue} from '@sentry/scraps/select';

import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatNumber} from 'sentry/utils/number/formatNumber';

const ROW_COUNT_VALUE_DEFAULT = 500;

/**
 * The largest export the backend serves synchronously rather than emailing.
 * Keep this in sync with data_export.py on the backend.
 */
const ROW_COUNT_VALUE_SYNC_LIMIT = 1000;

/** The largest row count the export modal offers as a selectable option. */
export const ROW_COUNT_VALUE_MAX = 10_000;

const ROW_COUNT_VALUES = [
  100,
  ROW_COUNT_VALUE_DEFAULT,
  ROW_COUNT_VALUE_SYNC_LIMIT,
  ROW_COUNT_VALUE_MAX,
];

export function generateExportRowCountOptions(estimatedRowCount: number) {
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
