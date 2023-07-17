import sortedIndexBy from 'lodash/sortedIndexBy';

import type {Crumb} from 'sentry/types/breadcrumbs';
import type {ReplayFrame} from 'sentry/utils/replays/types';
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

export function getNextReplayFrame({
  frames,
  targetOffsetMs,
  allowExact = false,
}: {
  frames: ReplayFrame[];
  targetOffsetMs: number;
  allowExact?: boolean;
}) {
  return frames.reduce<ReplayFrame | undefined>((found, item) => {
    if (
      item.offsetMs < targetOffsetMs ||
      (!allowExact && item.offsetMs === targetOffsetMs)
    ) {
      return found;
    }
    if (!found || item.timestampMs < found.timestampMs) {
      return item;
    }
    return found;
  }, undefined);
}
