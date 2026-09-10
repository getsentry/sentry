import {useCallback, useEffect, useState} from 'react';

import {useAutofixInteractionCount} from 'sentry/components/events/autofix/autofixInteractionStore';
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
 * Offers to take the reader to the issue's autofix section after they act on an
 * autofix embed in the Seer chat, since the result lands on the page behind the
 * chat panel where they are not looking.
 *
 * Stays quiet while the section is already on screen — the sidebar sits beside
 * the content on wide layouts and under it on narrow ones, so whether autofix
 * is visible at all depends on the layout, not on the reader's scroll position.
 *
 * Seeing the section counts as answering the prompt: once it scrolls into view
 * the offer is spent, and only a further interaction brings it back.
 */
export function useScrollToAutofixPrompt(groupId: string): ScrollToAutofixPrompt {
  const interactionCount = useAutofixInteractionCount(groupId);
  const [answeredCount, setAnsweredCount] = useState(interactionCount);
  const [, setIsCollapsed] = useSyncedLocalStorageState(
    getFoldSectionKey(SectionKey.SEER),
    false
  );

  const isPending = interactionCount > answeredCount;
  const position = useAutofixSectionPosition(isPending);

  useEffect(() => {
    if (isPending && position === 'onScreen') {
      setAnsweredCount(interactionCount);
    }
  }, [isPending, position, interactionCount]);

  const scrollToAutofix = useCallback(() => {
    setAnsweredCount(interactionCount);
    setIsCollapsed(false);
    // Expanding the fold moves the anchor, so wait for that render to land.
    requestAnimationFrame(() => {
      document
        .getElementById(SectionKey.SEER)
        ?.scrollIntoView({block: 'start', behavior: 'smooth'});
    });
  }, [interactionCount, setIsCollapsed]);

  const isOffScreen = position === 'above' || position === 'below';

  return {
    direction: isPending && isOffScreen ? (position === 'below' ? 'down' : 'up') : null,
    scrollToAutofix,
  };
}
