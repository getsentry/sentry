import {useCallback, useEffect, useRef, type UIEventHandler} from 'react';

import {defined} from 'sentry/utils';

interface UseAutoScrollOptions {
  enabled: boolean;
  key: unknown;
}

export function useAutoScroll({enabled, key}: UseAutoScrollOptions) {
  const canAutoScroll = useRef(true);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!enabled || !canAutoScroll.current || !defined(container)) {
      return;
    }

    container.scrollTo?.({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [enabled, key]);

  const onScrollHandler: UIEventHandler = useCallback(event => {
    const {scrollTop, scrollHeight, clientHeight} = event.currentTarget;
    const atBottom = scrollHeight - scrollTop - clientHeight < 1;
    canAutoScroll.current = atBottom;
  }, []);

  return {
    containerRef,
    onScrollHandler,
  };
}
