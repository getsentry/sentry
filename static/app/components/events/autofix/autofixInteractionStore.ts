import {useCallback, useSyncExternalStore} from 'react';

/**
 * Counts the times a reader acted on an autofix embed in the Seer chat, keyed
 * by issue.
 *
 * A module-level store rather than a context: the embed renders inside the chat
 * panel and the only listener is the issue page the panel slides over, so the
 * two share no provider short of the app root.
 *
 * A count rather than a flag so a second interaction is distinguishable from
 * the first, and a listener that has already answered one can tell that more
 * news has arrived.
 */

const listeners = new Set<() => void>();
const countsByGroup = new Map<string, number>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function notifyAutofixInteraction(groupId: string): void {
  countsByGroup.set(groupId, (countsByGroup.get(groupId) ?? 0) + 1);
  for (const listener of listeners) {
    listener();
  }
}

export function useAutofixInteractionCount(groupId: string): number {
  const getSnapshot = useCallback(() => countsByGroup.get(groupId) ?? 0, [groupId]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
