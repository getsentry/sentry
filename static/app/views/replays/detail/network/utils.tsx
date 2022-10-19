import {defined} from 'sentry/utils';
import type {NetworkSpan} from 'sentry/views/replays/types';

export interface ISortConfig {
  asc: boolean;
  by: keyof NetworkSpan | string;
  getValue: (row: NetworkSpan) => any;
}

export const UNKNOWN_STATUS = 'unknown';

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

export const getResourceTypes = (networkSpans: NetworkSpan[]) =>
  Array.from(
    new Set(networkSpans.map(networkSpan => networkSpan.op.replace('resource.', '')))
  ).sort();

export const getStatusTypes = (networkSpans: NetworkSpan[]) =>
  Array.from(
    new Set(
      networkSpans
        .map(networkSpan => networkSpan.data.statusCode ?? UNKNOWN_STATUS)
        .map(String)
    )
  ).sort();
