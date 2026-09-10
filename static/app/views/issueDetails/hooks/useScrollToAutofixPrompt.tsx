import {useCallback, useEffect, useRef, useState} from 'react';

import {useAutofixResultCount} from 'sentry/components/events/autofix/autofixResultStore';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {getFoldSectionKey} from 'sentry/views/issueDetails/foldSection';

/**
 * `unknown` covers both "not watching yet" and "the section isn't on the page",
 * which are the same thing to a caller: there is nothing to point at.
 */
type SectionPosition = 'unknown' | 'onScreen' | 'above' | 'below';

/**
 * Watches the autofix section's position relative to the viewport, but only
 * while `enabled`. Nothing reads the position otherwise, and the section
 * outlives most reasons to care about it.
 */
function useAutofixSectionPosition(enabled: boolean): SectionPosition {
  const [position, setPosition] = useState<SectionPosition>('unknown');

  useEffect(() => {
    if (!enabled) {
      setPosition('unknown');
      return;
    }

    const element = document.getElementById(SectionKey.SEER);
    if (!element) {
      setPosition('unknown');
      return;
    }

    const observer = new IntersectionObserver(entries => {
      const entry = entries.at(-1);
      if (!entry) {
        return;
      }
      if (entry.isIntersecting) {
        setPosition('onScreen');
        return;
      }
      // `rootBounds` is null on the first callback in some browsers.
      const viewportBottom = entry.rootBounds?.bottom ?? window.innerHeight;
      setPosition(entry.boundingClientRect.top >= viewportBottom ? 'below' : 'above');
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);

  return position;
}

interface ScrollToAutofixPrompt {
  /**
   * Which way the reader has to travel to reach autofix. `null` while there is
   * nothing to prompt about.
   */
  direction: 'up' | 'down' | null;
  scrollToAutofix: () => void;
}

/**
 * Offers to take the reader to the issue's autofix section once a step
 * completes in the Seer chat, since the result also lands on the page behind
 * the chat panel, where they are not looking.
 *
 * Completion rather than the click that started the step: a click points at a
 * section that is still processing, and has nothing to show yet.
 *
 * Stays quiet while the section is already on screen — the sidebar sits beside
 * the content on wide layouts and under it on narrow ones, so whether autofix
 * is visible at all depends on the layout, not on the reader's scroll position.
 *
 * Seeing the section counts as answering the prompt: once it scrolls into view
 * the offer is spent, and only a further result brings it back.
 */
export function useScrollToAutofixPrompt(groupId: string): ScrollToAutofixPrompt {
  const resultCount = useAutofixResultCount(groupId);
  const [answeredCount, setAnsweredCount] = useState(resultCount);
  const [, setIsCollapsed] = useSyncedLocalStorageState(
    getFoldSectionKey(SectionKey.SEER),
    false
  );

  const isPending = resultCount > answeredCount;
  const position = useAutofixSectionPosition(isPending);

  // Both ways of answering the prompt need the count as of the moment they run,
  // not the one captured when a callback was memoized. Holding it in a ref keeps
  // `answer` free of dependencies, so the two callers stay correct however their
  // own dependency lists are later edited.
  const latestResultCount = useRef(resultCount);
  useEffect(() => {
    latestResultCount.current = resultCount;
  }, [resultCount]);

  const answer = useCallback(() => {
    setAnsweredCount(latestResultCount.current);
  }, []);

  useEffect(() => {
    if (isPending && position === 'onScreen') {
      answer();
    }
  }, [isPending, position, answer]);

  const scrollToAutofix = useCallback(() => {
    answer();
    setIsCollapsed(false);
    // Expanding the fold moves the anchor, so wait for that render to land.
    requestAnimationFrame(() => {
      document
        .getElementById(SectionKey.SEER)
        ?.scrollIntoView({block: 'start', behavior: 'smooth'});
    });
  }, [answer, setIsCollapsed]);

  const isOffScreen = position === 'above' || position === 'below';

  return {
    direction: isPending && isOffScreen ? (position === 'below' ? 'down' : 'up') : null,
    scrollToAutofix,
  };
}
