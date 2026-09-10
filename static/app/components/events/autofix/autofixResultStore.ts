import {useCallback, useEffect, useSyncExternalStore} from 'react';

/**
 * Counts the autofix steps that have completed in the Seer chat, keyed by
 * issue.
 *
 * A module-level store rather than a context: the embeds that report a result
 * render inside the chat panel and the only listener is the issue page the
 * panel slides over, so the two share no provider short of the app root.
 *
 * A count rather than a flag so a second result is distinguishable from the
 * first, and a listener that has already answered one can tell that more news
 * has arrived.
 */

const listeners = new Set<() => void>();
const countsByGroup = new Map<string, number>();

/**
 * Steps already announced this page load, keyed by issue and step.
 *
 * Seer markdown re-lexes on every streamed chunk and a paragraph holding an
 * embed remounts each time text is appended after it, so an embed sitting on a
 * finished step would otherwise announce it once per chunk. Reopening a
 * conversation replays its finished steps too, and that is not news either.
 *
 * The cost is that re-running a step already announced this page load stays
 * quiet. That only hides the prompt for someone who asked for the re-run and is
 * watching the chat, which is the one case where they do not need telling.
 */
const announcedSteps = new Set<string>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

/**
 * Announces a completed autofix step, at most once per issue and step.
 *
 * `isComplete` is a parameter rather than a caller-side condition so the hook
 * stays unconditional across the renders where a step is still processing.
 */
export function useAnnounceAutofixResult(
  groupId: string,
  step: string,
  isComplete: boolean
): void {
  useEffect(() => {
    if (!isComplete) {
      return;
    }

    const key = `${groupId}:${step}`;
    if (announcedSteps.has(key)) {
      return;
    }
    announcedSteps.add(key);

    countsByGroup.set(groupId, (countsByGroup.get(groupId) ?? 0) + 1);
    for (const listener of listeners) {
      listener();
    }
  }, [groupId, step, isComplete]);
}

export function useAutofixResultCount(groupId: string): number {
  const getSnapshot = useCallback(() => countsByGroup.get(groupId) ?? 0, [groupId]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
