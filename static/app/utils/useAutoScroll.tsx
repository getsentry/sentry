import {useCallback, useEffect, useRef, type UIEventHandler} from 'react';

import {defined} from 'sentry/utils/defined';

// Tolerance for sub-pixel rounding when deciding whether we sit at the bottom.
const BOTTOM_THRESHOLD_PX = 4;

interface UseAutoScrollOptions {
  key: unknown;
}

export function useAutoScroll({key}: UseAutoScrollOptions) {
  const canAutoScroll = useRef(true);
  const lastScrollTop = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;

    if (!canAutoScroll.current || !defined(container)) {
      return;
    }

    container.scrollTo?.({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom, key]);

  // Content keeps growing after `key` has settled: markdown renders, cards swap
  // in once their own requests resolve, and placeholders give way to real
  // content. Without this we scroll to whatever height the container happened
  // to have when `key` last changed, and then stop.
  useEffect(() => {
    const container = containerRef.current;

    if (!defined(container)) {
      return;
    }

    const observer = new MutationObserver(() => scrollToBottom());
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [scrollToBottom]);

  const onScrollHandler: UIEventHandler = useCallback(event => {
    const {scrollTop, scrollHeight, clientHeight} = event.currentTarget;
    const atBottom = scrollHeight - scrollTop - clientHeight < BOTTOM_THRESHOLD_PX;
    const scrolledUp = scrollTop < lastScrollTop.current;

    lastScrollTop.current = scrollTop;

    // Only the user scrolling away from the bottom should stop auto-scrolling.
    // A smooth scroll emits intermediate events that are not yet at the bottom,
    // so treating every one of those as intent would cancel our own animation.
    if (atBottom) {
      canAutoScroll.current = true;
    } else if (scrolledUp) {
      canAutoScroll.current = false;
    }
  }, []);

  return {
    containerRef,
    onScrollHandler,
  };
}
