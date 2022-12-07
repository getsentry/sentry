import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {NetworkSpan} from 'sentry/views/replays/types';

export interface ISortConfig {
  asc: boolean;
  by: keyof NetworkSpan | string;
  getValue: (row: NetworkSpan) => any;
}

export const UNKNOWN_STATUS = 'unknown';

export const ROW_HEIGHT = {
  header: 24,
  body: 28,
};

export const COLUMNS = [
  {
    key: 'status',
    label: t('Status'),
    field: 'status',
    sortFn: row => row.data.statusCode,
  },
  {key: 'path', label: t('Path'), field: 'description'},
  {key: 'type', label: t('Type'), field: 'op'},
  {key: 'size', label: t('Size'), field: 'size', sortFn: row => row.data.size},
  {
    key: 'duration',
    label: t('Duration'),
    field: 'duration',
    sortFn: row => row.endTimestamp - row.startTimestamp,
  },
  {key: 'timestamp', label: t('Timestamp'), field: 'startTimestamp'},
];

export function sortNetwork(
  network: NetworkSpan[],
  sortConfig: ISortConfig
): NetworkSpan[] {
  return [...network].sort((a, b) => {
    let valueA = sortConfig.getValue(a);
    let valueB = sortConfig.getValue(b);

    valueA = typeof valueA === 'string' ? valueA.toUpperCase() : valueA;
    valueB = typeof valueB === 'string' ? valueB.toUpperCase() : valueB;

    // if the values are not defined, we want to push them to the bottom of the list
    if (!defined(valueA)) {
      return 1;
    }

    if (!defined(valueB)) {
      return -1;
    }

    if (valueA === valueB) {
      return 0;
    }

    if (sortConfig.asc) {
      return valueA > valueB ? 1 : -1;
    }

    return valueB > valueA ? 1 : -1;
  });
}
