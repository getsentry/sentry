import {useMemo} from 'react';

import {defined} from 'sentry/utils/defined';
import {useReplayExists} from 'sentry/utils/replayCount/useReplayExists';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';

interface Props {
  enabled: boolean;
  items: OurLogsResponseItem[];
  end?: string;
  start?: string;
}

interface Result {
  hiddenCount: number;
  isResolving: boolean;
  items: OurLogsResponseItem[];
}

function getReplayId(item: OurLogsResponseItem) {
  const replayId = item[OurLogKnownFieldKey.REPLAY_ID];
  return typeof replayId === 'string' && replayId ? replayId : undefined;
}

/**
 * Drops logs whose `replay_id` points at a replay that was never stored.
 *
 * Relay stamps `replay_id` from the DSC whether or not the replay was sampled, so the
 * attribute is present on most logs and resolves for few of them. This checks each id
 * against `/replay-count/` and hides the ones that resolve to nothing.
 *
 * Scoped to the logs already loaded into the table — counts, graphs and aggregates are
 * unaffected.
 */
export function useStoredReplayFilter({items, start, end, enabled}: Props): Result {
  const {getReplayCounts} = useReplayExists({start, end});

  const replayIds = enabled ? [...new Set(items.map(getReplayId).filter(defined))] : [];

  // Buffers the ids into the shared `/replay-count/` cache as a side effect, so it has
  // to run even before anything can be filtered.
  const counts = getReplayCounts(replayIds);

  // A count of `undefined` means we haven't heard back about that id yet. Keeping those
  // rows visible avoids flickering them out and back in as each batch resolves.
  const missingIdsKey = replayIds.filter(replayId => counts[replayId] === 0).join(',');
  const unresolvedCount = replayIds.filter(
    replayId => counts[replayId] === undefined
  ).length;

  // Memoized because callers key rendering off the identity of `items`.
  return useMemo(() => {
    if (!enabled) {
      return {items, hiddenCount: 0, isResolving: false};
    }

    const missingIds = new Set(missingIdsKey ? missingIdsKey.split(',') : []);
    const kept = items.filter(item => {
      const replayId = getReplayId(item);
      return defined(replayId) && !missingIds.has(replayId);
    });

    return {
      items: kept,
      hiddenCount: items.length - kept.length,
      isResolving: unresolvedCount > 0,
    };
  }, [enabled, items, missingIdsKey, unresolvedCount]);
}
