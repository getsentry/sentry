import sortedIndexBy from 'lodash/sortedIndexBy';

import type {Crumb} from 'sentry/types/breadcrumbs';
import type {ReplaySpan} from 'sentry/views/replays/types';

export function getPrevReplayEvent<T extends ReplaySpan | Crumb>({
  itemLookup,
  items,
  targetTimestampMs,
}: {
  items: T[];
  targetTimestampMs: number;
  itemLookup?: number[][];
}) {
  if (!itemLookup || !itemLookup.length) {
    return undefined;
  }

  const index = sortedIndexBy(itemLookup, [targetTimestampMs], o => o[0]);
  if (index !== undefined && index > 0) {
    const ts = itemLookup[Math.min(index, itemLookup.length - 1)][0];
    return items[
      itemLookup[ts === targetTimestampMs ? index : Math.max(0, index - 1)][1]
    ];
  }

  return undefined;
}

export function getNextReplayEvent<T extends ReplaySpan | Crumb>({
  items,
  targetTimestampMs,
  allowExact = false,
}: {
  items: T[];
  targetTimestampMs: number;
  allowExact?: boolean;
}) {
  return items.reduce<T | undefined>((found, item) => {
    const itemTimestampMS = +new Date(item.timestamp || '');

    if (
      itemTimestampMS < targetTimestampMs ||
      (!allowExact && itemTimestampMS === targetTimestampMs)
    ) {
      return found;
    }
    if (!found || itemTimestampMS < +new Date(found.timestamp || '')) {
      return item;
    }
    return found;
  }, undefined);
}
